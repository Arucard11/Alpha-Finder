// PnL Calculation Added: Tuesday, April 1, 2025 at 7:11:03 AM UTC
const dotenv = require("dotenv")
dotenv.config()
const { getTotalRunners, updateWallet, addWallet } = require('../DB/querys.js');
const { connection } = require('./connection.js');
const { PublicKey } = require('@solana/web3.js');
const { getRecentBuys } = require('./getTransactions.js');

// Simple delay helper function
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function for retrying async operations
async function retryAsyncOperation(fn, maxAttempts = 3, delayMs = 1000, context = '') {
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    try {
      return await fn();
    } catch (error) {
      const isLastError = attempts === maxAttempts;
      const errorCode = error.code; // Specific code for SolanaJSONRPCError or system errors
      const isRetriableSolanaError = errorCode === -32019; // "Failed to query long-term storage"
      const isConnectionReset = errorCode === 'ECONNRESET'; // Connection reset by peer
      const isTimeout = errorCode === 'ETIMEDOUT'; // Connection timed out

      // Check if it's a fetch error with a 5xx status code
      // Note: The original fetch call might throw before providing a response object (e.g., network error)
      // So we need to handle cases where error.response might not exist.
      let isHttpServerError = false;
      if (error.response && typeof error.response.status === 'number' && error.response.status >= 500 && error.response.status < 600) {
        isHttpServerError = true;
      }

      // More comprehensive check for retriable conditions
      const shouldRetry = !isLastError && (
        isRetriableSolanaError ||
        isConnectionReset ||
        isTimeout ||
        isHttpServerError ||
        error.message.includes('fetch failed') || // Generic fetch failure
        error.message.includes('network error') || // Generic network failure
        error.message.includes('terminated') // Explicitly retry on "terminated" error message
      );

      if (shouldRetry) {
        const statusInfo = isHttpServerError ? ` (Status: ${error.response.status})` : '';
        const codeInfo = errorCode ? ` (Code: ${errorCode})` : '';
        console.warn(`Attempt ${attempts} failed for ${context}${statusInfo}${codeInfo}. Retrying in ${delayMs}ms... Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Optional: exponential backoff
      } else {
        const statusInfo = (error.response && error.response.status) ? ` (Status: ${error.response.status})` : '';
         const codeInfo = errorCode ? ` (Code: ${errorCode})` : '';
        console.error(`Final attempt ${attempts} failed for ${context}${statusInfo}${codeInfo}. Error: ${error.message}`);
        // Optionally log the full error object for more details on final failure
        // console.error("Full error object:", error); 
        throw error; // Re-throw the error if it's the last attempt or not a retriable error
      }
    }
  }
  // Should not be reached if maxAttempts > 0, but satisfies typescript/linting if it expects a return path
  throw new Error(`Operation failed after ${maxAttempts} attempts for context: ${context}`);
}

/**
 * Wallet helper: checks if the wallet is inactive (dead) for over 30 days.
 * Looks at the timestamp of the latest transaction.
 */
async function checkIfDeadWallet(address) {
  try {
    const signatures = await retryAsyncOperation(
      () => connection.getSignaturesForAddress(
        new PublicKey(address),
        { limit: 1 } // Only need the latest signature
      ),
      3, // maxAttempts
      1000, // initialDelayMs
      `getSignaturesForAddress (dead check) for ${address}`
    );

    if (!signatures || signatures.length === 0 || !signatures[0].blockTime) {
        // No transactions found or missing blockTime, cannot determine inactivity based on this.
        // Consider it not dead by this definition.
        return false;
    }

    const latestSig = signatures[0];
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoTimestampMs = Date.now() - THIRTY_DAYS_MS;

    // blockTime is in seconds, convert to milliseconds for comparison
    const latestTxTimestampMs = latestSig.blockTime * 1000;

    return latestTxTimestampMs < thirtyDaysAgoTimestampMs;

  } catch (error) {
    console.error(`Failed checkIfDeadWallet for ${address} after retries:`, error);
    // If there's an error fetching (e.g., invalid address or final retry failure), assume not dead
    return false;
  }
}

/**
 * Wallet helper: checks if the wallet qualifies as a comeback trader.
 * Original logic checks for >= 50 transactions older than 30 days.
 */
async function checkIfComebackTrader(address) {
  try {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoTimestampSec = (Date.now() - THIRTY_DAYS_MS) / 1000; // Work in seconds

    const signatures = await retryAsyncOperation(
      () => connection.getSignaturesForAddress(
        new PublicKey(address),
        { limit: 100 }
      ),
      3, // maxAttempts
      1000, // initialDelayMs
      `getSignaturesForAddress (comeback check) for ${address}`
    );

    if (!signatures || signatures.length === 0) {
        return false; // No transactions, not a comeback trader
    }

    let totalOldTxns = 0;
    for (const sig of signatures) {
      if (sig.blockTime && sig.blockTime < thirtyDaysAgoTimestampSec) {
        totalOldTxns++;
      }
    }
    return totalOldTxns >= 50;

  } catch (error) {
    console.error(`Failed checkIfComebackTrader for ${address} after retries:`, error);
    // If final retry fails, assume not a comeback trader
    return false;
  }
}

/**
 * Returns how many runners had sells after the $5M market cap timestamp.
 */
function totalRunnersSoldPastFiveMillion(runners) {
  let total = 0;
  // No need for nowSec as we check specific sell timestamps against the $5M timestamp

  for (const runner of runners) {
    // Check for the fiveMillion timestamp
    const tFiveMillion = runner.timestamps?.fiveMillion;
    const sells = runner.transactions?.sell;

    // Skip if $5M timestamp is missing or no sells occurred
    if (tFiveMillion == null || !sells || sells.length === 0) continue;

    // Check if at least one sell occurred after the $5M timestamp
    const soldPastFiveM = sells.some(s => s.timestamp != null && s.timestamp > tFiveMillion);

    if (soldPastFiveM) {
        total++;
    }
  }
  return total;
}

// Configuration for sandwich bot detection
const sandwichConfig = {
    minTotalTransactions: 4,
    timeThresholdSeconds: 60,
    amountThresholdPercent: 0.60,
    minSandwichPairs: 3,
    minSameTypeTxCloseness: 3 // NEW: Minimum close buys or sells to flag as bot
};

/**
 * Helper function to detect potential sandwich bot behavior for a specific runner.
 * Now also checks if buys or sells are close in time to each other.
 */
function isPotentialSandwichBot(runner, config) {
    const buys = runner.transactions?.buy || [];
    const sells = runner.transactions?.sell || [];
    const totalTransactions = buys.length + sells.length;

    if (totalTransactions < config.minTotalTransactions) return false;

    const allTxns = [
        ...buys.map(tx => ({ ...tx, type: 'buy', usd_value: (tx.amount || 0) * (tx.price || 0), timestamp: tx.timestamp })),
        ...sells.map(tx => ({ ...tx, type: 'sell', usd_value: (tx.amount || 0) * (tx.price || 0), timestamp: tx.timestamp }))
    ];

    const validTxns = allTxns.filter(tx => typeof tx.timestamp === 'number' && !isNaN(tx.timestamp));
    validTxns.sort((a, b) => a.timestamp - b.timestamp);

    let sandwichPairCount = 0;
    for (let i = 0; i < validTxns.length - 1; i++) {
        const currentTx = validTxns[i];
        const nextTx = validTxns[i + 1];

        if (currentTx.type === nextTx.type) continue;

        const timeDiff = nextTx.timestamp - currentTx.timestamp;
        if (timeDiff > config.timeThresholdSeconds || timeDiff < 0) continue;

        if (currentTx.usd_value > 0 && nextTx.usd_value > 0) {
            const absValueDiff = Math.abs(nextTx.usd_value - currentTx.usd_value);
            const relativeDiff = absValueDiff / currentTx.usd_value;
            if (relativeDiff > config.amountThresholdPercent) continue;
        } else if (currentTx.usd_value === 0 && nextTx.usd_value === 0) {
             continue; // Cannot compare amounts if both zero
        } else {
            continue; // One is zero, one isn't - not similar
        }

        sandwichPairCount++;
        if (sandwichPairCount >= config.minSandwichPairs) return true;
    }

    // Configurable closeness for same-type txs
    const buyTimestamps = buys.map(tx => tx.timestamp).filter(ts => typeof ts === 'number' && !isNaN(ts));
    const sellTimestamps = sells.map(tx => tx.timestamp).filter(ts => typeof ts === 'number' && !isNaN(ts));
    buyTimestamps.sort((a, b) => a - b);
    sellTimestamps.sort((a, b) => a - b);

    let buyClosenessCount = 0;
    for (let i = 0; i < buyTimestamps.length - 1; i++) {
        const timeDiff = buyTimestamps[i + 1] - buyTimestamps[i];
        if (timeDiff > 0 && timeDiff <= config.timeThresholdSeconds) {
            buyClosenessCount++;
        }
    }

    let sellClosenessCount = 0;
    for (let i = 0; i < sellTimestamps.length - 1; i++) {
        const timeDiff = sellTimestamps[i + 1] - sellTimestamps[i];
        if (timeDiff > 0 && timeDiff <= config.timeThresholdSeconds) {
            sellClosenessCount++;
        }
    }

    // Use the new config value for closeness threshold
    const hasCloseBuys = buyClosenessCount >= (config.minSameTypeTxCloseness || 1);
    const hasCloseSells = sellClosenessCount >= (config.minSameTypeTxCloseness || 1);

    return sandwichPairCount >= config.minSandwichPairs || hasCloseBuys || hasCloseSells;
}

/**
 * Wallet helper: checks if the wallet has an excessively high number of transactions
 * in a recent period, indicating potential bot activity.
 */
async function isHighVolumeActivityBot(address, connection) {
  const SIGNATURE_THRESHOLD = 10000;
  const MAX_SIGNATURES_TO_CHECK = 10000; // Changed to 10000
  const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;
  const recentPeriodCutoffSec = Math.floor(Date.now() / 1000) - THIRTY_DAYS_SEC;
  let recentSignaturesCount = 0;
  let lastSignature = null;
  let signaturesChecked = 0;

  console.log(`[HighVolumeCheck] Starting for ${address}. Cutoff: ${new Date(recentPeriodCutoffSec * 1000).toISOString()} (last 30 days), Max Signatures to Check: ${MAX_SIGNATURES_TO_CHECK}, Signature Threshold: ${SIGNATURE_THRESHOLD}`);

  try {
    while (signaturesChecked < MAX_SIGNATURES_TO_CHECK) {
      const options = { limit: 1000 };
      if (lastSignature) {
        options.before = lastSignature;
      }

      const signatures = await retryAsyncOperation(
        () => connection.getSignaturesForAddress(new PublicKey(address), options),
        3, // maxAttempts
        1000, // initialDelayMs
        `getSignaturesForAddress (high volume check) for ${address}, batch starting before ${lastSignature}`
      );

      if (!signatures || signatures.length === 0) {
        // No more signatures to fetch
        break;
      }

      for (const sig of signatures) {
        signaturesChecked++;
        if (sig.blockTime && sig.blockTime >= recentPeriodCutoffSec) {
          recentSignaturesCount++;
          if (recentSignaturesCount >= SIGNATURE_THRESHOLD) { // Changed from > to >=
            console.log(`[HighVolumeCheck] Wallet ${address} identified as high-volume bot. Found ${recentSignaturesCount} recent signatures (checked ${signaturesChecked}).`);
            return true; // Threshold exceeded or met
          }
        } else if (sig.blockTime && sig.blockTime < recentPeriodCutoffSec) {
          // Signatures are now older than our cutoff period
          console.log(`[HighVolumeCheck] Wallet ${address} - reached signatures older than cutoff. Found ${recentSignaturesCount} recent (checked ${signaturesChecked}).`);
          return false;
        }
        // Ensure we don't check more than MAX_SIGNATURES_TO_CHECK even within the last batch
        if (signaturesChecked >= MAX_SIGNATURES_TO_CHECK) {
            break; 
        }
      }

      if (signatures.length < 1000) {
        // Fetched less than the limit, so it's the last batch
        break;
      }
      lastSignature = signatures[signatures.length - 1].signature;

      if (signaturesChecked >= MAX_SIGNATURES_TO_CHECK) {
          console.log(`[HighVolumeCheck] Wallet ${address} - hit MAX_SIGNATURES_TO_CHECK (${MAX_SIGNATURES_TO_CHECK}) while fetching batches. Found ${recentSignaturesCount} recent.`);
          break;
      }
      await delay(300); // Small delay between batches
    }
  } catch (error) {
    console.error(`[HighVolumeCheck] Error during high volume check for ${address}:`, error);
    return false; // On error, assume not a high-volume bot to avoid false positives
  }

  console.log(`[HighVolumeCheck] Wallet ${address} is NOT a high-volume bot after checking ${signaturesChecked} signatures. Found ${recentSignaturesCount} recent signatures.`);
  return false; // Threshold not exceeded within checked signatures
}

// =========================
//  HELPER FUNCTIONS FOR SCORING (Timestamp-based)
// =========================
function computeEarlyBuyPoints(runner) {
    if (!runner.timestamps || runner.timestamps.early == null || !runner.transactions?.buy || runner.transactions.buy.length === 0) return 2;
    const threshold = runner.timestamps.early;
    const buyTimestamps = runner.transactions.buy.map(b => b.timestamp).filter(ts => ts != null);
    if (buyTimestamps.length === 0) return 2;
    const firstBuy = Math.min(...buyTimestamps);
    if (firstBuy >= threshold) return 2;
    let bestPoints = 0;
    const timeWindow = threshold - firstBuy;
    if (timeWindow <= 0) return 2; // Avoid division issues if firstBuy >= threshold somehow

    for (const buy of runner.transactions.buy) {
        if (buy.timestamp == null) continue;
        let currentPoints = 2;
        if (buy.timestamp < threshold) {
            const fraction = (threshold - buy.timestamp) / timeWindow;
            if (fraction >= 0.75) currentPoints = 5;
            else if (fraction >= 0.50) currentPoints = 4;
            else if (fraction >= 0.25) currentPoints = 3;
        }
        bestPoints = Math.max(bestPoints, currentPoints);
    }

    const maxBuyValue = Math.max(0, ...runner.transactions.buy.map(b => (b.amount || 0) * (b.price || 0)));
    if (maxBuyValue < 5 && maxBuyValue > 0) bestPoints = Math.max(bestPoints - 1, 1);
    else if (bestPoints === 0) bestPoints = 2;
    return bestPoints;
}

function computeHoldingMultiplier(runner) {
    const tEarly = runner.timestamps?.early;
    const tMaxProfitStart = runner.timestamps?.maxProfitStart;
    const tMaxProfitEnd = runner.timestamps?.maxProfitEnd;
    const tTwoMillion = runner.timestamps?.twoMillion;
    const tFiveMillion = runner.timestamps?.fiveMillion;
    const tTenMillion = runner.timestamps?.tenMillion;
    const tTwentyMillion = runner.timestamps?.twentyMillion;

    let maxMultiplier = 1.0;
    const sells = runner.transactions?.sell;

    if (sells && sells.length > 0) {
        let achievedMultiplier = 0.7;
        for (const sell of sells) {
             if (sell.timestamp == null) continue;

            let currentSellMultiplier = 0.7;

            if (tMaxProfitStart != null && tMaxProfitEnd != null && sell.timestamp >= tMaxProfitStart && sell.timestamp <= tMaxProfitEnd) {
                currentSellMultiplier = 2.5;
            }
            else if (tTwentyMillion != null && sell.timestamp > tTwentyMillion) currentSellMultiplier = 2.2;
            else if (tTenMillion != null && sell.timestamp > tTenMillion) currentSellMultiplier = 2.0;
            else if (tFiveMillion != null && sell.timestamp > tFiveMillion) currentSellMultiplier = 1.8;
            else if (tTwoMillion != null && sell.timestamp > tTwoMillion) currentSellMultiplier = 1.5;
            else if (tMaxProfitEnd != null && sell.timestamp > tMaxProfitEnd) currentSellMultiplier = 0.9;

            achievedMultiplier = Math.max(achievedMultiplier, currentSellMultiplier);
        }
        maxMultiplier = achievedMultiplier;
    } else {
         maxMultiplier = 1.0;
    }
    return maxMultiplier;
}

function computeConvictionBonus(runner) {
    const tMaxProfitStart = runner.timestamps?.maxProfitStart;
    const tMaxProfitEnd = runner.timestamps?.maxProfitEnd;
    const tTwoMillion = runner.timestamps?.twoMillion;
    const tFiveMillion = runner.timestamps?.fiveMillion;
    const tTenMillion = runner.timestamps?.tenMillion;
    const tTwentyMillion = runner.timestamps?.twentyMillion;

    let bonus = 1.0;
    const hasSells = runner.transactions?.sell && runner.transactions.sell.length > 0;
    const buys = runner.transactions?.buy;

    if (!hasSells) {
        if (!buys || buys.length === 0) return 1.0;
        const validBuyTimestamps = buys.map(b => b.timestamp).filter(ts => ts != null);
        if (validBuyTimestamps.length === 0) return 1.0;
        const latestBuyTimestamp = Math.max(...validBuyTimestamps);
        const nowSec = Math.floor(Date.now() / 1000);
        const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;
        const maxBuyValue = Math.max(0, ...buys.map(b => (b.amount || 0) * (b.price || 0)));

        if (maxBuyValue < 5 && maxBuyValue > 0) bonus = 1.0;
        else bonus = (nowSec - latestBuyTimestamp <= THIRTY_DAYS_SEC) ? 1.5 : 1.2;

    } else {
        let achievedBonus = 0.8;
        for (const sell of runner.transactions.sell) {
             if (sell.timestamp == null) continue;

            let currentSellBonus = 0.8;
            if (tMaxProfitStart != null && tMaxProfitEnd != null && sell.timestamp >= tMaxProfitStart && sell.timestamp <= tMaxProfitEnd) {
                currentSellBonus = 1.5;
            }
            else if (tTwentyMillion != null && sell.timestamp > tTwentyMillion) currentSellBonus = 1.3;
            else if (tTenMillion != null && sell.timestamp > tTenMillion) currentSellBonus = 1.2;
            else if (tFiveMillion != null && sell.timestamp > tFiveMillion) currentSellBonus = 1.1;
            else if (tTwoMillion != null && sell.timestamp > tTwoMillion) currentSellBonus = 1.0;
            else if (tMaxProfitEnd != null && sell.timestamp > tMaxProfitEnd) currentSellBonus = 0.9;

            achievedBonus = Math.max(achievedBonus, currentSellBonus);
        }
        bonus = achievedBonus;
    }
    return bonus;
}

function computeEarlyExitPenalty(runner) {
    const tEarly = runner.timestamps?.early;
    const tMaxProfitStart = runner.timestamps?.maxProfitStart;
    const sells = runner.transactions?.sell;

    if (!sells || sells.length === 0 || tEarly == null || tMaxProfitStart == null || tMaxProfitStart <= tEarly) return 0;

    let maxPenaltyFraction = 0;
    const timeWindow = tMaxProfitStart - tEarly;
    if (timeWindow <= 0) return 0;

    for (const sell of sells) {
        if (sell.timestamp == null) continue;

        if (sell.timestamp < tMaxProfitStart) {
            const fractionSkipped = (tMaxProfitStart - sell.timestamp) / timeWindow;

            let currentPenalty = 0;
            if (fractionSkipped > 0.75) currentPenalty = 0.40;
            else if (fractionSkipped > 0.50) currentPenalty = 0.30;
            else if (fractionSkipped > 0.25) currentPenalty = 0.20;
            else if (fractionSkipped > 0) currentPenalty = 0.10;

            maxPenaltyFraction = Math.max(maxPenaltyFraction, currentPenalty);
        }
    }
    return maxPenaltyFraction;
}

/**
 * Main scoring function: Assigns badges and calculates scores including PnL.
 */
async function scoreWallets(convertedWallets) {
  const pLimit = (await import('p-limit')).default;
  const limit = pLimit(10); // Concurrency limit set to 10
  console.log(`Starting scoring for ${convertedWallets.length} wallets with p-limit concurrency of 10...`);

  // Worker function for a single wallet
  async function processWallet(wallet, index) {
    console.log(`[processWallet] START for ${wallet?.address}. Wallet state: `, JSON.stringify({ address: wallet?.address, runnerCount: wallet?.runners?.length, runnerSymbols: wallet?.runners?.map(r => r.symbol) }, null, 2));
    // Add a staggered delay based on index to respect rate limits (100 req/sec)
    // With 10 concurrent wallets, stagger by 200ms each to spread out requests
    const staggerDelay = index % 10 * 200;
    await delay(staggerDelay);
    console.log(`[${new Date().toISOString()}] Delayed ${staggerDelay}ms before starting wallet ${index + 1}/${convertedWallets.length}: ${wallet.address}`);
    
    // Add a small delay before processing each wallet to potentially avoid rate limits
    await delay(500); 
    // Ensure wallet and wallet.runners are valid
    if (!wallet || !wallet.address) {
        console.warn(`Skipping processing: Invalid wallet object provided for index ${index}.`, wallet);
        return null; // Skip this wallet
    }
    // --- Log Start --- 
    console.log(`[${new Date().toISOString()}] (Wallet ${index + 1}/${convertedWallets.length}) Starting processing for wallet: ${wallet.address}`);
    // --------------- 

    if (!Array.isArray(wallet.runners)) {
        console.warn(`Wallet ${wallet.address} has invalid or missing runners property. Initializing as empty array.`);
        wallet.runners = [];
    }

    let verifiedUniqueBuysCount = 0; // Renamed from totalWalletTokens
    let badgedWallet = wallet;
    badgedWallet.badges = badgedWallet.badges || []; // Ensure badges array exists

    // --- NEW: High Volume Activity Bot Check ---
    try {
      console.log(`[${new Date().toISOString()}] Checking for high volume activity for wallet: ${wallet.address}`);
      const isHighVolumeBot = await isHighVolumeActivityBot(wallet.address, connection);
      if (isHighVolumeBot) {
        if (!badgedWallet.badges.includes('bot')) {
          badgedWallet.badges.push('bot');
        }
        // If identified as high-volume bot, we might skip further processing or just rely on the 'bot' badge.
        // For now, we'll let it proceed to sandwich check, but further badge/score calc might be skipped.
        console.log(`[${new Date().toISOString()}] Wallet ${wallet.address} flagged as high-volume bot. Badge added.`);
      }
    } catch (e) {
      console.error(`Error during high volume activity check for wallet ${wallet.address}:`, e);
      // Continue processing even if this check fails, to not miss other types of bots or valid wallets.
    }
    // --- END NEW: High Volume Activity Bot Check ---

    // Only fetch recent buys if not already flagged as a high-volume bot
    if (!badgedWallet.badges.includes('bot')) {
    try {
      // Call the new function to get verified buys from the last 90 days via RPC
      console.log(`[${new Date().toISOString()}] Fetching verified buys via RPC for ${wallet.address}...`);
      const boughtMints = await getRecentBuys(wallet.address);
      verifiedUniqueBuysCount = boughtMints.length;
      console.log(`[${new Date().toISOString()}] Found ${verifiedUniqueBuysCount} verified buys for ${wallet.address}.`);
    } catch (e) {
      console.error(`Error fetching recent buys via RPC for wallet ${wallet.address}:`, e);
      // Keep verifiedUniqueBuysCount at 0 if RPC call fails
      }
    } else {
      console.log(`[${new Date().toISOString()}] Wallet ${wallet.address} is flagged as a high-volume bot, skipping getRecentBuys.`);
      verifiedUniqueBuysCount = 0; // Ensure count is 0 if skipped
    }

    const runnerCount = badgedWallet.runners.length;

    // --- Log Badge Calculation Start ---
    console.log(`[${new Date().toISOString()}] (Wallet ${index + 1}/${convertedWallets.length}) Starting badge calculation for wallet: ${wallet.address}`);
    // ---------------------------------

    // --- PRE-CHECK FOR BOT BEHAVIOR (Sandwich etc.) ---
    // Only run this if not already flagged as a high-volume bot, as that's a more general bot flag.
    if (!badgedWallet.badges.includes('bot')) {
    for (const runner of badgedWallet.runners) {
      if (isPotentialSandwichBot(runner, sandwichConfig)) {
        if (!badgedWallet.badges.includes('bot')) {
          badgedWallet.badges.push('bot');
        }
            console.log(`[${new Date().toISOString()}] Wallet ${wallet.address} flagged as potential sandwich bot. Badge added.`);
        break; // Wallet is flagged as bot, no need to check other runners for this purpose.
          }
      }
    }
    // --- END PRE-CHECK FOR BOT BEHAVIOR ---

    // Define all badges in this category + conflicting ones
    // This list is used for cleaning up badges before assigning a new percentage-based badge
    // or the 'one hit wonder' badge.
    const percentageBadgesToRemove = [
        'ultimate trader', 'elite trader', 'grandmaster trader', 'master trader',
        'expert trader', 'highly specialized trader', 'specialized trader',
        'focused trader', 'potential alpha', 'mid trader', 'degen sprayer',
        'one hit wonder' 
    ];

    // --- Ratio-Based Badge Calculation --- START
    // Skip percentage badge calculation if 'bot' badge is already present
    if (!badgedWallet.badges.includes('bot')) {
        const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60; // Changed from NINETY_DAYS_SEC
        const thirtyDaysAgoSec = Math.floor(Date.now() / 1000) - THIRTY_DAYS_SEC; // Renamed from ninetyDaysAgoSec

        const runnersWithRecentBuysCount = badgedWallet.runners.filter(runner =>
            runner.transactions?.buy?.some(buy =>
                typeof buy.timestamp === 'number' && buy.timestamp >= thirtyDaysAgoSec
            )
        ).length;

        // Use the verified count from getRecentBuys for the ratio denominator
        const ratio = verifiedUniqueBuysCount > 0 ? (runnersWithRecentBuysCount / verifiedUniqueBuysCount) * 100 : 0;

        let targetPercentageBadge = null;
        if (runnerCount > 1) { // Only assign these if not a one-hit wonder
            if (ratio > 90) targetPercentageBadge = 'ultimate trader';
            else if (ratio > 80) targetPercentageBadge = 'elite trader';
            else if (ratio > 70) targetPercentageBadge = 'grandmaster trader';
            else if (ratio > 60) targetPercentageBadge = 'master trader';
            else if (ratio > 50) targetPercentageBadge = 'expert trader';
            else if (ratio > 40) targetPercentageBadge = 'highly specialized trader';
            else if (ratio > 30) targetPercentageBadge = 'specialized trader';
            else if (ratio > 20) targetPercentageBadge = 'focused trader';
            else if (ratio > 4) targetPercentageBadge = 'potential alpha'; // Ratio <= 20%
            else if (ratio >= 2) targetPercentageBadge = 'mid trader';      // Ratio <= 4%
            else targetPercentageBadge = 'degen sprayer';                  // Ratio < 2%
        }

        // Clean existing badges before adding the new one
        if (targetPercentageBadge) {
            badgedWallet.badges = badgedWallet.badges.filter(b => !percentageBadgesToRemove.includes(b));
            badgedWallet.badges.push(targetPercentageBadge);
        }
    }
    // --- Ratio-Based Badge Calculation --- END

    // --- Other Badge Logic --- START
    // Only assign these if not a bot
    if (!badgedWallet.badges.includes('bot')) {
    // 1) One-Hit Wonder (check this first)
    if (runnerCount === 1) {
        // Ensure it doesn't conflict with previously assigned percentage badges (shouldn't happen due to logic above, but good practice)
        if (!badgedWallet.badges.includes('one hit wonder')) {
             // Still clean potentially conflicting percentage badges if assigning one hit wonder
             badgedWallet.badges = badgedWallet.badges.filter(b => !percentageBadgesToRemove.includes(b)); 
             badgedWallet.badges.push('one hit wonder');
        }
    }
    // 2) Legendary Buyer
    else if (runnerCount >= 10) {
        // Now, simply add legendary buyer if the condition is met, regardless of percentage badges.
        if (!badgedWallet.badges.includes('legendary buyer')) {
            badgedWallet.badges.push('legendary buyer');
        } 
    }
    
    // Note: The old ratio-based badge assignment block is removed.

    // 4) High Conviction
    else if (
      badgedWallet.runners.some(runner =>
        runner.transactions?.sell?.some(sell =>
          runner.timestamps?.twoMillion != null && sell.timestamp != null && sell.timestamp > runner.timestamps.twoMillion
        )
      )
    ) {
       if (!badgedWallet.badges.includes('high conviction')) badgedWallet.badges.push('high conviction');
    }
    // 7) Diamond Hands (Redefined: multiple runners sold past '$5M')
    else if (totalRunnersSoldPastFiveMillion(badgedWallet.runners) >= 2) {
        if (!badgedWallet.badges.includes('diamond hands')) badgedWallet.badges.push('diamond hands');
    }
    // 8) Whale Buyer
    else if (
      badgedWallet.runners.some(runner =>
        (runner.transactions?.buy?.some(b => (b.amount || 0) * (b.price || 0) >= 5000)) ||
        (runner.transactions?.sell?.some(s => (s.amount || 0) * (s.price || 0) >= 5000))
      )
    ) {
       if (!badgedWallet.badges.includes('whale buyer')) badgedWallet.badges.push('whale buyer');
    }
    // 9) Dead Wallet
    else if (await checkIfDeadWallet(badgedWallet.address)) {
       if (!badgedWallet.badges.includes('dead wallet')) badgedWallet.badges.push('dead wallet');
    }
    // 10) Comeback Trader
    else if (await checkIfComebackTrader(badgedWallet.address)) {
       // Ensure it doesn't add if 'dead wallet' is present (checkIfComebackTrader might need adjustment if dead wallets can be comebacks)
       if (!badgedWallet.badges.includes('dead wallet') && !badgedWallet.badges.includes('comeback trader')) {
           badgedWallet.badges.push('comeback trader');
           }
       }
    }
    // --- Other Badge Logic --- END


    // Final cleanup - remove duplicates and ensure one hit wonder is removed if multiple runners
    if (runnerCount > 1) {
      badgedWallet.badges = badgedWallet.badges.filter(b => b !== 'one hit wonder');
    }
    badgedWallet.badges = [...new Set(badgedWallet.badges)];

    // --- Calculate token scores, wallet score, and PnL --- 
    for (const runner of badgedWallet.runners) {
      // --- Calculate Runner PnL First --- START
      let runnerBuyValue = 0;
      let runnerSellValue = 0;

      const buys = runner.transactions?.buy || [];
      const sells = runner.transactions?.sell || [];

      buys.forEach(buy => {
        runnerBuyValue += (buy.amount || 0) * (buy.price || 0);
      });
      sells.forEach(sell => {
        runnerSellValue += (sell.amount || 0) * (sell.price || 0);
      });

      const hasActualBuys = buys.length > 0;
      const hasActualSells = sells.length > 0;

      if (runnerBuyValue === 0 && hasActualSells) {
        runner.pnl = 0; // PnL is 0 if there are sells but no (value in) buys
      } else {
        const calculatedPnl = runnerSellValue - runnerBuyValue;
        runner.pnl = isNaN(calculatedPnl) ? 0 : calculatedPnl; // Store runner PnL
      }
       // --- Calculate Runner PnL First --- END

      if (runner.scored) {
        continue; // Ensure wallet totals still include scored runners if run multiple times
      }

      // --- NEW: Check for PnL Bonus Eligibility based on sell prices vs buy prices --- START
      let isEligibleForPnlBonus = false;
      const buyPrices = (runner.transactions?.buy || []).map(b => b.price).filter(p => typeof p === 'number' && p !== null);
      const sellPrices = (runner.transactions?.sell || []).map(s => s.price).filter(p => typeof p === 'number' && p !== null);

      if (buyPrices.length > 0 && sellPrices.length > 0) {
        const maxBuyPrice = Math.max(...buyPrices);
        // Check if ALL sell prices are strictly greater than the MAX buy price
        const allSellsStrictlyHigher = sellPrices.every(sellPrice => sellPrice > maxBuyPrice);
        if (allSellsStrictlyHigher) {
          isEligibleForPnlBonus = true;
        }
      }
      // --- NEW: Check for PnL Bonus Eligibility based on sell prices vs buy prices --- END

      const hasBuys = runner.transactions?.buy && runner.transactions.buy.length > 0;
      const hasSells = runner.transactions?.sell && runner.transactions.sell.length > 0;

      // Default score for buy-only runners
      if (hasBuys && !hasSells) {
        runner.score = 2; // Keep default score for holders without sells yet
        runner.scored = true;
        continue;
      }

      // Calculate scoring components using updated functions
      const earlyBuyPoints = computeEarlyBuyPoints(runner);
      const holdingMultiplier = computeHoldingMultiplier(runner);
      const convictionBonus = computeConvictionBonus(runner);
      const earlyExitPenalty = computeEarlyExitPenalty(runner);

      // --- PnL Multiplier Logic --- START
      let pnlMultiplier = 1.0;
      if (runnerBuyValue > 0.01) { // Avoid division by zero or tiny values
          const pnlPercentage = runner.pnl / runnerBuyValue;
          if (runner.pnl < 0) { // Negative PnL - penalty applies regardless of new eligibility condition
               pnlMultiplier = Math.max(0.1, 1 + pnlPercentage); // e.g., -50% -> 0.5 multiplier
          } else if (runner.pnl > 0 && isEligibleForPnlBonus) { // Positive PnL - bonus applies ONLY if eligible
              // Positive PnL increases score, scale based on percentage gain
              // Map [0, +Infinity] PnL percentage to [1.0, 2.0] multiplier (capped)
              pnlMultiplier = Math.min(2.0, 1 + pnlPercentage / 2); // e.g., +100% (1.0) -> 1.5 multiplier, +200% (2.0) -> 2.0 multiplier
          }
          // If runner.pnl > 0 but !isEligibleForPnlBonus, pnlMultiplier remains 1.0 (no bonus for this part)
          // If runner.pnl === 0, pnlMultiplier also remains 1.0
      } else if (runner.pnl < -0.01) { // Handle negative PnL even if buy value is near zero (e.g., fees) - penalty applies
            pnlMultiplier = 0.5; // Apply a moderate penalty
      }
      // --- PnL Multiplier Logic --- END

      // Calculate base score including PnL effect
      const baseScore = earlyBuyPoints * holdingMultiplier * convictionBonus * pnlMultiplier;

      // Apply early exit penalty
      const finalTokenScore = baseScore * (1 - earlyExitPenalty);

      runner.score = isNaN(finalTokenScore) ? 0 : finalTokenScore;
      runner.scored = true;
    }

    // Calculate overall wallet PnL (sum of individual runner.pnl values)
    let cumulativeWalletPnl = 0;
    badgedWallet.runners.forEach(runner => {
        cumulativeWalletPnl += (runner.pnl || 0); // Summing up the PnL already calculated for each runner
    });
    badgedWallet.pnl = cumulativeWalletPnl;
    if (isNaN(badgedWallet.pnl)) badgedWallet.pnl = 0; // Safeguard for NaN

    // Calculate wallet confidence score (based on runner scores and success rate)
    const sumTokenScores = badgedWallet.runners.reduce((acc, r) => acc + (r.score || 0), 0);

    // --- Success Rate Calculation (Updated) --- START
    let runnersEligibleForRate = 0; // Renamed from boughtBelowCount
    let successCount = 0;
    const nowSecWallet = Math.floor(Date.now() / 1000); // This variable is used later for decay

    for (const runner of badgedWallet.runners) {
      // tEarly is no longer a direct condition for being in the denominator for success rate.
      // const tEarly = runner.timestamps?.early; 
      const tMaxProfitStart = runner.timestamps?.maxProfitStart;
      const tMaxProfitEnd = runner.timestamps?.maxProfitEnd;

      // A runner is considered for the success rate if their max profit zone is defined.
      // The 'early buy' condition is removed from here.
      if (tMaxProfitStart == null || tMaxProfitEnd == null) {
        continue; // Skip if essential timestamps for profit zone are missing
      }

      runnersEligibleForRate++; // This runner is eligible to be part of the success rate calculation.

      // Check if SOLD WITHIN the max profit zone
      let soldInZone = false;
      const runnerHasSells = runner.transactions?.sell && runner.transactions.sell.length > 0;

      if (runnerHasSells) {
          // Success is having at least one sell *within* the zone
          if (runner.transactions.sell.some(s => s.timestamp != null && s.timestamp >= tMaxProfitStart && s.timestamp <= tMaxProfitEnd)) {
              soldInZone = true;
          }
      }
      // Holding past the zone is no longer considered a success for this metric

      if (soldInZone) {
        successCount++; // Count as successful sell timing
      }
    }
    // --- Success Rate Calculation (Updated) --- END

    const successRate = runnersEligibleForRate > 0 ? (successCount / runnersEligibleForRate) * 100 : 0;

    // Wallet multiplier based on success rate (unchanged logic, just uses updated rate)
    let walletMultiplier = 0.5;
    if (successRate >= 50) walletMultiplier = 1.5;
    else if (successRate >= 20) walletMultiplier = 1.2;
    else if (successRate >= 10) walletMultiplier = 1.0;

    // Calculate activity decay (unchanged logic)
    let lastActivity = 0;
    for (const runner of badgedWallet.runners) {
      const buyTimes = runner.transactions?.buy?.map(b => b.timestamp).filter(ts => ts != null) || [];
      const sellTimes = runner.transactions?.sell?.map(s => s.timestamp).filter(ts => ts != null) || [];
      const maxTimeRunner = Math.max(0, ...buyTimes, ...sellTimes);
      if (maxTimeRunner > lastActivity) lastActivity = maxTimeRunner;
    }
    let decayAmount = 0;
    if (lastActivity > 0) {
      const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60; const inactiveTimeSec = nowSecWallet - lastActivity - THIRTY_DAYS_SEC;
      if (inactiveTimeSec > 0) {
        const weeksInactive = Math.floor(inactiveTimeSec / (7 * 24 * 60 * 60));
        if (weeksInactive > 0) decayAmount = sumTokenScores * (weeksInactive * 0.02);
      }
    }
    const calculatedScore = (sumTokenScores * walletMultiplier) - decayAmount;
    badgedWallet.confidence_score = isNaN(calculatedScore) ? 0 : Math.max(0, calculatedScore);

    // --- Log End Calculation --- 
    console.log(`[${new Date().toISOString()}] Finished calculations for wallet: ${wallet.address}. Saving...`);
    // ------------------------- 

    const savedWallet = await finalizeWallet(badgedWallet);

    // --- Log Save Result --- 
    if (savedWallet) {
      console.log(`[${new Date().toISOString()}] Successfully saved wallet: ${wallet.address}`);
      // Log wallet and all runner addresses and names
      if (savedWallet.runners && Array.isArray(savedWallet.runners)) {
        console.log(`Wallet ${savedWallet.address} runners:`);
        savedWallet.runners.forEach((runner, idx) => {
          console.log(`  Runner ${idx + 1}: address=${runner.address}, name=${runner.name}`);
        });
      }
    } else {
      // Error is already logged within finalizeWallet
      console.warn(`[${new Date().toISOString()}] Failed to save wallet: ${wallet.address}`);
    }
    // -----------------------

    // --- Progress Bar / Progress Log ---
    console.log(`[Progress] Processed ${index + 1} of ${convertedWallets.length} wallets (${(((index + 1) / convertedWallets.length) * 100).toFixed(1)}%)`);
    // -----------------------------------

    return savedWallet; // Return the result from finalizeWallet
  }

  // Save to DB and cleanup
  async function finalizeWallet(wallet) {
    console.log(`[finalizeWallet] PRE-SAVE for ${wallet?.address}. Wallet state: `, JSON.stringify({ address: wallet?.address, runnerCount: wallet?.runners?.length, runnerSymbols: wallet?.runners?.map(r => r.symbol), badges: wallet?.badges, confidence_score: wallet?.confidence_score, pnl: wallet?.pnl }, null, 2));
    for (const runner of wallet.runners) {
      if (runner.timestamps && runner.timestamps.hasOwnProperty('allprices')) delete runner.timestamps.allprices;
      if (typeof runner.score !== 'number' || isNaN(runner.score)) runner.score = 0;
      if (typeof runner.pnl !== 'number' || isNaN(runner.pnl)) runner.pnl = 0;
    }
    if (typeof wallet.confidence_score !== 'number' || isNaN(wallet.confidence_score)) wallet.confidence_score = 0;
    if (typeof wallet.pnl !== 'number' || isNaN(wallet.pnl)) wallet.pnl = 0;
    if (!Array.isArray(wallet.badges)) wallet.badges = [];
    try {
      if (wallet.id) {
        await updateWallet(wallet.id, 'runners', wallet.runners);
        await updateWallet(wallet.id, 'confidence_score', wallet.confidence_score);
        await updateWallet(wallet.id, 'badges', wallet.badges);
        await updateWallet(wallet.id, 'pnl', wallet.pnl);
      } else {
        if (!wallet.address) {
          console.warn("Skipping addWallet: Wallet missing address.", wallet);
          return null;
        }
        await addWallet(wallet);
      }
      return wallet;
    } catch (err) {
      // Log the address for easier debugging
      console.error(`Error saving wallet ${wallet?.address || '[address missing]'}:`, err);
      return null;
    }
  }

  // Run the pool using p-limit
  const promises = convertedWallets.map((wallet, index) => 
    limit(() => processWallet(wallet, index))
  );
  const results = await Promise.all(promises);

  const processed = results.filter(Boolean);
  console.log(`Database operations complete. Processed data for ${processed.length}/${convertedWallets.length} wallets.`);
}

module.exports = scoreWallets;