// PnL Calculation Added: Tuesday, April 1, 2025 at 7:11:03 AM UTC
const dotenv = require("dotenv")
dotenv.config()
const { getTotalRunners, updateWallet, addWallet } = require('../DB/querys.js');
const { connection } = require('./connection.js');
const { PublicKey } = require('@solana/web3.js');

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
    minSandwichPairs: 1
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

    // New check for closeness among buys or sells
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

    // Consider it a potential bot if there are multiple close buys or sells
    const hasCloseBuys = buyClosenessCount >= config.minSandwichPairs;
    const hasCloseSells = sellClosenessCount >= config.minSandwichPairs;
    return sandwichPairCount >= config.minSandwichPairs || hasCloseBuys || hasCloseSells;
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
        const NINETY_DAYS_SEC = 90 * 24 * 60 * 60;
        const maxBuyValue = Math.max(0, ...buys.map(b => (b.amount || 0) * (b.price || 0)));

        if (maxBuyValue < 5 && maxBuyValue > 0) bonus = 1.0;
        else bonus = (nowSec - latestBuyTimestamp <= NINETY_DAYS_SEC) ? 1.5 : 1.2;

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
 * Helper function to fetch wallet transactions for the past 90 days and calculate unique coins bought.
 * Returns an object with the count of unique coins bought and runners in the 90-day window.
 */
async function getWalletActivityIn90Days(walletAddress, runners, apiOptions) {
    // Ensure runners is an array before proceeding
    const safeRunners = Array.isArray(runners) ? runners : [];
    
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgoMs = Date.now() - NINETY_DAYS_MS;
    let uniqueCoinsBought = new Set();
    let runnersInWindow = 0;
    let allTransactions = [];
    let beforeParam = '';
    const limit = 1000;

    try {
        // Fetch transactions until we cover 90 days or no more data
        while (true) {
            const url = `https://public-api.birdeye.so/v1/wallet/tx_list?wallet=${walletAddress}&limit=${limit}${beforeParam ? `&before=${beforeParam}` : ''}`;
            
            // Add a small delay before each API call within the pagination loop
            await delay(500); 

            let response;
            try {
                response = await retryAsyncOperation(
                    () => fetch(url, apiOptions),
                    3, // maxAttempts
                    1000, // initialDelayMs
                    `fetch Birdeye tx_list for ${walletAddress} (before=${beforeParam || ''})`
                );

                // If retryAsyncOperation completes without throwing, but the response is still not ok,
                // it means the final attempt resulted in a non-5xx error (e.g., 4xx).
                if (!response.ok) {
                    console.error(`Birdeye API request for ${walletAddress} failed permanently after retries with status ${response.status}: ${response.statusText}. URL: ${url}`);
                    // Attempt to read body for more details, but don't let it crash the loop
                    try {
                        const errorBody = await response.text();
                        console.error(`Error response body (truncated): ${errorBody.substring(0, 500)}`);
                    } catch (bodyError) {
                        console.error(`Could not read error response body after non-OK status.`);
                    }
                    break; // Stop fetching for this wallet if a permanent error occurs
                }

            } catch (fetchError) {
                // This catch block now specifically handles errors thrown by retryAsyncOperation
                // after all retries have failed (likely due to persistent 5xx, network issues, or connection resets).
                console.error(`Final fetch attempt failed for Birdeye tx_list for ${walletAddress} after retries. Error: ${fetchError.message}. URL: ${url}`);
                // Optionally log the full error if needed for debugging
                // console.error("Full fetch error object:", fetchError);
                break; // Break loop if fetch fails definitively
            }
            
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                // Handle JSON parsing errors specifically
                const errorMessage = parseError.message || '';
                console.error(`Error parsing JSON for wallet ${walletAddress} from URL ${url}. Status: ${response.status}. Error: ${errorMessage}`);
                
                // Attempt to read response text, but don't let it crash
                let responseText = '';
                try {
                    responseText = await response.text();
                    if (responseText) {
                       console.error("Received non-JSON response body (truncated):", responseText.substring(0, 500));
                    }
                } catch (textError) {
                     console.error("Could not read response text after JSON parse failure.");
                }

                // Specific Handling: If the error is 'terminated' (connection likely cut mid-stream), 
                // let the outer loop continue, potentially allowing retryAsyncOperation to try again.
                // Otherwise, break the loop for this wallet as it's a more permanent parse failure.
                if (errorMessage.includes('terminated')) {
                    console.warn(`JSON parsing terminated for ${walletAddress}, stopping transaction processing for this wallet due to incomplete data.`);
                    // Intentionally do nothing here, the while(true) loop will continue
                    // If the *fetch* itself threw 'terminated', retryAsyncOperation handles it.
                    // If response.json() throws 'terminated', this might indicate an incomplete stream
                    // that a subsequent full retry *might* fix. Breaking here would prevent that.
                    // NOTE: This could still lead to an infinite loop if 'terminated' always happens for a specific URL.
                    // Consider adding a specific counter here if that becomes an issue.
                    break; // BREAKING seems safer than potentially looping forever on a bad response.
                           // If retryAsyncOperation *didn't* catch 'terminated', this prevents endless loops.
                } else {
                    break; // Break the loop for other JSON parsing errors
                }
            }

            // Check for API success and if data exists before accessing length
            if (!data.success || !data.data || !data.data.solana) { // Modified check slightly for safety
                 console.warn(`Birdeye API request for ${walletAddress} successful but returned no data or success=false.`);
                 break;
            }
            
            const transactions = data.data.solana;
            allTransactions.push(...transactions);

            // OPTIMIZATION: If fewer transactions than the limit were returned, assume no more data
            if (transactions.length < limit) {
                break; 
            }

            // Original Logic: Check timestamp of the LAST transaction in this batch
            const lastTx = transactions[transactions.length - 1];
            // Add safety check for blockTime existence (already existed, kept)
            if (!lastTx || !lastTx.blockTime) {
                console.warn(`Transaction missing blockTime for wallet ${walletAddress}, stopping pagination.`);
                break;
            }
            const lastTxTimeMs = new Date(lastTx.blockTime).getTime();
            if (lastTxTimeMs > ninetyDaysAgoMs) {
                beforeParam = lastTx.txHash;
            } else {
                 // Oldest tx is outside 90 days, so we stop
                break;
            }
        }

        // Filter transactions for buys within 90 days and collect unique tokens
        for (const tx of allTransactions) {
            // Add safety check for blockTime existence
            if (!tx.blockTime) continue;
            const txTimeMs = new Date(tx.blockTime).getTime();
            if (txTimeMs < ninetyDaysAgoMs) continue;

            // Infer buy transaction if balanceChange shows positive amount for a token (not SOL)
            if (tx.balanceChange) {
                for (const change of tx.balanceChange) {
                    // Check if amount is positive and address is not SOL
                    if (change.amount > 0 && change.address !== 'So11111111111111111111111111111111111111112') {
                        uniqueCoinsBought.add(change.address);
                    }
                }
            }
        }

        // Count runners with early timestamp in the last 90 days
        for (const runner of safeRunners) {
            const earlyTimestamp = runner.timestamps?.early;
            if (earlyTimestamp && earlyTimestamp * 1000 >= ninetyDaysAgoMs) {
                runnersInWindow++;
            }
        }

        return {
            uniqueCoinsBoughtCount: uniqueCoinsBought.size,
            runnersInWindow: runnersInWindow
        };
    } catch (error) {
        // Catch any unexpected errors in the outer try block
        console.error(`Unexpected error in getWalletActivityIn90Days for wallet ${walletAddress}:`, error);
        return {
            uniqueCoinsBoughtCount: 0,
            runnersInWindow: 0
        };
    }
}

// Manual promise pool for concurrency limiting
async function promisePool(items, worker, concurrency) {
  const results = [];
  let i = 0;
  async function next() {
    if (i >= items.length) return;
    const currentIndex = i++;
    results[currentIndex] = await worker(items[currentIndex], currentIndex);
    await next();
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

/**
 * Main scoring function: Assigns badges and calculates scores including PnL.
 */
async function scoreWallets(convertedWallets) {
  const options = {
    method: 'GET',
    headers: {accept: 'application/json', 'x-chain': 'solana', 'X-API-KEY': `${process.env.BIRDEYE_API_KEY}`},
  };
  const concurrencyLimit = 1; // Reduced from 3 to 1
  console.log(`Starting scoring for ${convertedWallets.length} wallets...`);

  // Worker function for a single wallet
  async function processWallet(wallet, index) {
    // Add a small delay before processing each wallet to potentially avoid rate limits
    await delay(200); 

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

    let totalWalletTokens = 0;
    let badgedWallet = wallet;
    badgedWallet.badges = badgedWallet.badges || []; // Ensure badges array exists

    try {
      const activityData = await getWalletActivityIn90Days(wallet.address, wallet.runners, options);
      totalWalletTokens = activityData.uniqueCoinsBoughtCount || 0; // Default to 0 if undefined
    } catch (e) {
      console.error("Error fetching 90-day activity for wallet:", e);
      totalWalletTokens = 0; // Assume 0 if fetch fails
    }

    const runnerCount = badgedWallet.runners.length;

    // --- Log Badge Calculation Start ---
    console.log(`[${new Date().toISOString()}] (Wallet ${index + 1}/${convertedWallets.length}) Starting badge calculation for wallet: ${wallet.address}`);
    // ---------------------------------

    // --- Ratio-Based Badge Calculation --- START
    const NINETY_DAYS_SEC = 90 * 24 * 60 * 60;
    const ninetyDaysAgoSec = Math.floor(Date.now() / 1000) - NINETY_DAYS_SEC;

    const runnersWithRecentBuysCount = badgedWallet.runners.filter(runner => 
        runner.transactions?.buy?.some(buy => 
            typeof buy.timestamp === 'number' && buy.timestamp >= ninetyDaysAgoSec
        )
    ).length;

    const ratio = totalWalletTokens > 0 ? (runnersWithRecentBuysCount / totalWalletTokens) * 100 : 0; 

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
    
    // Define all badges in this category + conflicting ones
    const percentageBadgesToRemove = [
        'ultimate trader', 'elite trader', 'grandmaster trader', 'master trader', 
        'expert trader', 'highly specialized trader', 'specialized trader', 
        'focused trader', 'potential alpha', 'mid trader', 'degen sprayer',
        'one hit wonder' // Keep removing one hit wonder
    ];

    // Clean existing badges before adding the new one
    if (targetPercentageBadge) {
        badgedWallet.badges = badgedWallet.badges.filter(b => !percentageBadgesToRemove.includes(b));
        badgedWallet.badges.push(targetPercentageBadge);
    }
    // --- Ratio-Based Badge Calculation --- END


    // --- Other Badge Logic --- START
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
    // --- Other Badge Logic --- END


    // Final cleanup - remove duplicates and ensure one hit wonder is removed if multiple runners
    if (runnerCount > 1) {
      badgedWallet.badges = badgedWallet.badges.filter(b => b !== 'one hit wonder');
    }
    badgedWallet.badges = [...new Set(badgedWallet.badges)];

    // --- Calculate token scores, wallet score, and PnL --- 
    let totalWalletBuyValue = 0;
    let totalWalletSellValue = 0;
    for (const runner of badgedWallet.runners) {
      // --- Calculate Runner PnL First --- START
      let runnerBuyValue = 0;
      let runnerSellValue = 0;
      (runner.transactions?.buy || []).forEach(buy => {
        runnerBuyValue += (buy.amount || 0) * (buy.price || 0);
      });
      (runner.transactions?.sell || []).forEach(sell => {
        runnerSellValue += (sell.amount || 0) * (sell.price || 0);
      });
      const runnerPnl = runnerSellValue - runnerBuyValue;
      runner.pnl = isNaN(runnerPnl) ? 0 : runnerPnl; // Store runner PnL

      // Add runner values to wallet totals *after* calculating runner PnL
      totalWalletBuyValue += runnerBuyValue;
      totalWalletSellValue += runnerSellValue;
       // --- Calculate Runner PnL First --- END

      if (runner.scored) {
        continue; // Ensure wallet totals still include scored runners if run multiple times
      }

      const hasBuys = runner.transactions?.buy && runner.transactions.buy.length > 0;
      const hasSells = runner.transactions?.sell && runner.transactions.sell.length > 0;

      // Default score for buy-only runners
      if (hasBuys && !hasSells) {
        runner.score = 2; // Keep default score for holders without sells yet
        runner.scored = true;
        continue;
      }

      // Check for bot behavior
      if (isPotentialSandwichBot(runner, sandwichConfig)) {
        if (!badgedWallet.badges.includes('bot')) {
          badgedWallet.badges.push('bot');
          // Maybe apply a score penalty directly for bots? For now, just badge.
        }
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
          if (runner.pnl < 0) {
              // Negative PnL reduces score, scale based on percentage loss
              // e.g., -100% PnL -> 0 multiplier? Too harsh. Let's cap reduction.
              // Map [-Infinity, 0] PnL percentage to [0.1, 1.0] multiplier
               pnlMultiplier = Math.max(0.1, 1 + pnlPercentage); // e.g., -50% -> 0.5 multiplier
          } else {
              // Positive PnL increases score, scale based on percentage gain
              // Map [0, +Infinity] PnL percentage to [1.0, 2.0] multiplier (capped)
              pnlMultiplier = Math.min(2.0, 1 + pnlPercentage / 2); // e.g., +100% (1.0) -> 1.5 multiplier, +200% (2.0) -> 2.0 multiplier
          }
      } else if (runner.pnl < -0.01) { // Handle negative PnL even if buy value is near zero (e.g., fees)
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

    // Calculate overall wallet PnL (sum of runner buy/sell values)
    badgedWallet.pnl = totalWalletSellValue - totalWalletBuyValue;
    if (isNaN(badgedWallet.pnl)) badgedWallet.pnl = 0;

    // Calculate wallet confidence score (based on runner scores and success rate)
    const sumTokenScores = badgedWallet.runners.reduce((acc, r) => acc + (r.score || 0), 0);

    // --- Success Rate Calculation (Updated) --- START
    let boughtBelowCount = 0;
    let successCount = 0;
    const nowSecWallet = Math.floor(Date.now() / 1000);

    for (const runner of badgedWallet.runners) {
      const tEarly = runner.timestamps?.early;
      const tMaxProfitStart = runner.timestamps?.maxProfitStart;
      const tMaxProfitEnd = runner.timestamps?.maxProfitEnd;

      if (tEarly == null || tMaxProfitStart == null || tMaxProfitEnd == null) continue;

      const anyBuyEarly = runner.transactions?.buy?.some(b => b.timestamp != null && b.timestamp <= tEarly);
      if (!anyBuyEarly) continue; // Didn't buy early enough

      boughtBelowCount++; // Count this runner as having bought early

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

      if (soldInZone) successCount++; // Count as successful sell timing
    }
    // --- Success Rate Calculation (Updated) --- END

    const successRate = boughtBelowCount > 0 ? (successCount / boughtBelowCount) * 100 : 0;

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
    } else {
      // Error is already logged within finalizeWallet
      console.warn(`[${new Date().toISOString()}] Failed to save wallet: ${wallet.address}`);
    }
    // -----------------------
    return savedWallet; // Return the result from finalizeWallet
  }

  // Save to DB and cleanup
  async function finalizeWallet(wallet) {
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

  // Run the pool
  const results = await promisePool(convertedWallets, (wallet, index) => processWallet(wallet, index), concurrencyLimit);
  const processed = results.filter(Boolean);
  console.log(`Database operations complete. Processed data for ${processed.length}/${convertedWallets.length} wallets.`);
}

module.exports = scoreWallets;