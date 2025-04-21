// PnL Calculation Added: Tuesday, April 1, 2025 at 7:11:03 AM UTC
const dotenv = require("dotenv")
dotenv.config()
const { getTotalRunners, updateWallet, addWallet } = require('../DB/querys.js');
const { connection } = require('./connection.js');
const { PublicKey } = require('@solana/web3.js');

/**
 * Wallet helper: checks if the wallet is inactive (dead) for over 30 days.
 * Looks at the timestamp of the latest transaction.
 */
async function checkIfDeadWallet(address) {
  try {
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(address),
      { limit: 1 } // Only need the latest signature
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
    console.error(`Error fetching signatures for ${address} in checkIfDeadWallet:`, error);
    // If there's an error fetching (e.g., invalid address), assume not dead
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

    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(address),
      { limit: 100 }
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
    console.error(`Error fetching signatures for ${address} in checkIfComebackTrader:`, error);
    return false;
  }
}


/**
 * Returns how many runners are held past the 'late' threshold.
 */
function totalRunnersHeldPastLate(runners) {
  let total = 0;
  const nowSec = Math.floor(Date.now() / 1000);

  for (const runner of runners) {
    const tLate = runner.timestamps?.late;
    const hasSells = runner.transactions?.sell && runner.transactions.sell.length > 0;

    if (tLate == null) continue;

    let heldPast = false;
    if (!hasSells) {
      if (nowSec > tLate) heldPast = true;
    } else {
      if (runner.transactions.sell.some(s => s.timestamp != null && s.timestamp > tLate)) {
        heldPast = true;
      }
    }

    if (heldPast) total++;
  }
  return total;
}

// Configuration for sandwich bot detection
const sandwichConfig = {
    minTotalTransactions: 4,
    timeThresholdSeconds: 60,
    amountThresholdPercent: 0.30,
    minSandwichPairs: 2
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
    const tLate = runner.timestamps?.late;
    const tTwoMillion = runner.timestamps?.twoMillion;
    const tFiveMillion = runner.timestamps?.fiveMillion;
    let maxMultiplier = 1.0;
    const sells = runner.transactions?.sell;
    if (sells && sells.length > 0) {
        let achievedMultiplier = 0.7;
        for (const sell of sells) {
             if (sell.timestamp == null) continue;
            let currentSellMultiplier = 0.7;
            if (tFiveMillion != null && sell.timestamp >= tFiveMillion) currentSellMultiplier = 1.5;
            else if (tTwoMillion != null && sell.timestamp >= tTwoMillion) currentSellMultiplier = 1.2;
            else if (tLate != null && sell.timestamp >= tLate) currentSellMultiplier = 1.0;
            achievedMultiplier = Math.max(achievedMultiplier, currentSellMultiplier);
        }
        maxMultiplier = achievedMultiplier;
    }
    return maxMultiplier;
}

function computeConvictionBonus(runner) {
    const tLate = runner.timestamps?.late;
    const tTwoMillion = runner.timestamps?.twoMillion;
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
            if (tTwoMillion != null && sell.timestamp >= tTwoMillion) currentSellBonus = 1.2;
            else if (tLate != null && sell.timestamp >= tLate) currentSellBonus = 1.0;
            achievedBonus = Math.max(achievedBonus, currentSellBonus);
        }
        bonus = achievedBonus;
    }
    return bonus;
}

function computeEarlyExitPenalty(runner) {
    const tEarly = runner.timestamps?.early;
    const tLate = runner.timestamps?.late;
    const sells = runner.transactions?.sell;
    if (!sells || sells.length === 0 || tEarly == null || tLate == null || tLate <= tEarly) return 0;
    let maxPenaltyFraction = 0;
    const timeWindow = tLate - tEarly;
    if (timeWindow <= 0) return 0;
    for (const sell of sells) {
        if (sell.timestamp == null) continue;
        if (sell.timestamp < tLate) {
            const fractionSkipped = (tLate - sell.timestamp) / timeWindow;
            let currentPenalty = 0;
            if (fractionSkipped > 0.75) currentPenalty = 0.40;
            else if (fractionSkipped > 0.50) currentPenalty = 0.30;
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
            const response = await fetch(url, apiOptions);
            const data = await response.json();

            if (!data.success || !data.data.solana || data.data.solana.length === 0) {
                break;
            }

            const transactions = data.data.solana;
            allTransactions.push(...transactions);

            // Check if the oldest transaction is still within 90 days; if so, fetch more
            const lastTx = transactions[transactions.length - 1];
            const lastTxTimeMs = new Date(lastTx.blockTime).getTime();
            if (lastTxTimeMs > ninetyDaysAgoMs) {
                beforeParam = lastTx.txHash;
            } else {
                break;
            }
        }

        // Filter transactions for buys within 90 days and collect unique tokens
        for (const tx of allTransactions) {
            const txTimeMs = new Date(tx.blockTime).getTime();
            if (txTimeMs < ninetyDaysAgoMs) continue;

            // Infer buy transaction if balanceChange shows positive amount for a token (not SOL)
            if (tx.balanceChange) {
                for (const change of tx.balanceChange) {
                    if (change.amount > 0 && change.address !== 'So11111111111111111111111111111111111111112') {
                        uniqueCoinsBought.add(change.address);
                    }
                }
            }
        }

        // Count runners with early timestamp in the last 90 days
        for (const runner of runners) {
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
        console.error(`Error fetching 90-day activity for wallet ${walletAddress}:`, error);
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
  const concurrencyLimit = 5;
  console.log(`Starting scoring for ${convertedWallets.length} wallets...`);

  // Worker function for a single wallet
  async function processWallet(wallet) {
    let totalWalletTokens = 0;
    let runnersIn90Days = 0;
    let badgedWallet = wallet;
    try {
      const activityData = await getWalletActivityIn90Days(wallet.address, wallet.runners, options);
      totalWalletTokens = activityData.uniqueCoinsBoughtCount || 100;
      runnersIn90Days = activityData.runnersInWindow;
    } catch (e) {
      console.error("Error fetching 90-day activity for wallet:", e);
      totalWalletTokens = 100;
    }
    badgedWallet.badges = badgedWallet.badges || [];
    const runnerCount = badgedWallet.runners.length;
    // 1) One-Hit Wonder (check this first)
    if (runnerCount === 1) {
      badgedWallet.badges.push('one hit wonder');
      // Early return since one-hit wonders shouldn't get other badges
      return await finalizeWallet(badgedWallet);
    }
    // 2) Legendary Buyer
    if (runnerCount >= 10) {
      badgedWallet.badges.push('legendary buyer');
    }
    // New Ratio-Based Badges for 90-Day Activity
    else if (totalWalletTokens > 0) {
      const ratio = (runnersIn90Days / totalWalletTokens) * 100;
      if (ratio > 90) {
        badgedWallet.badges = badgedWallet.badges.filter(b => !['one hit wonder', 'mid trader', 'degen sprayer', 'potential alpha'].includes(b));
        badgedWallet.badges.push('ultimate trader');
      } else if (ratio > 80) {
        badgedWallet.badges = badgedWallet.badges.filter(b => !['one hit wonder', 'mid trader', 'degen sprayer', 'potential alpha'].includes(b));
        badgedWallet.badges.push('elite trader');
      } else if (ratio > 70) {
        badgedWallet.badges = badgedWallet.badges.filter(b => !['one hit wonder', 'mid trader', 'degen sprayer', 'potential alpha'].includes(b));
        badgedWallet.badges.push('grandmaster trader');
      } else if (ratio > 60) {
        badgedWallet.badges = badgedWallet.badges.filter(b => !['one hit wonder', 'mid trader', 'degen sprayer', 'potential alpha'].includes(b));
        badgedWallet.badges.push('master trader');
      } else if (ratio > 50) {
        badgedWallet.badges = badgedWallet.badges.filter(b => !['one hit wonder', 'mid trader', 'degen sprayer', 'potential alpha'].includes(b));
        badgedWallet.badges.push('expert trader');
      } else if (ratio > 40) {
        badgedWallet.badges = badgedWallet.badges.filter(b => !['one hit wonder', 'mid trader', 'degen sprayer', 'potential alpha'].includes(b));
        badgedWallet.badges.push('highly specialized trader');
      } else if (ratio > 30) {
        badgedWallet.badges = badgedWallet.badges.filter(b => !['one hit wonder', 'mid trader', 'degen sprayer', 'potential alpha'].includes(b));
        badgedWallet.badges.push('specialized trader');
      } else if (ratio > 20) {
        badgedWallet.badges = badgedWallet.badges.filter(b => !['one hit wonder', 'mid trader', 'degen sprayer', 'potential alpha'].includes(b));
        badgedWallet.badges.push('focused trader');
      } else if (ratio > 4 && ratio <= 20) {
        badgedWallet.badges = badgedWallet.badges.filter(b => !['one hit wonder', 'mid trader', 'degen sprayer'].includes(b));
        badgedWallet.badges.push('potential alpha');
      } else if (ratio <= 4 && ratio >= 2) {
        badgedWallet.badges = badgedWallet.badges.filter(b => b !== 'one hit wonder' && b !== 'degen sprayer');
        badgedWallet.badges.push('mid trader');
      } else if (ratio < 2) {
        badgedWallet.badges = badgedWallet.badges.filter(b => b !== 'one hit wonder');
        badgedWallet.badges.push('degen sprayer');
      }
    }
    // 4) High Conviction
    else if (
      badgedWallet.runners.some(runner =>
        runner.transactions.sell.some(sell =>
          runner.timestamps?.twoMillion && sell.timestamp > runner.timestamps.twoMillion
        )
      )
    ) {
      badgedWallet.badges.push('high conviction');
    }
    // 7) Diamond Hands (multiple runners held past 'late')
    else if (totalRunnersHeldPastLate(badgedWallet.runners) >= 2) {
      badgedWallet.badges = badgedWallet.badges.filter(b => b !== 'one hit wonder');
      badgedWallet.badges.push('diamond hands');
    }
    // 8) Whale Buyer
    else if (
      badgedWallet.runners.some(runner =>
        (runner.transactions.buy.some(b => b.amount * b.price >= 5000)) ||
        (runner.transactions.sell.some(s => s.amount * s.price >= 5000))
      )
    ) {
      badgedWallet.badges.push('whale buyer');
    }
    // 9) Dead Wallet
    else if (await checkIfDeadWallet(badgedWallet.address)) {
      badgedWallet.badges.push('dead wallet');
    }
    // 10) Comeback Trader
    else if (await checkIfComebackTrader(badgedWallet.address)) {
      badgedWallet.badges = badgedWallet.badges.filter(b => b !== 'dead wallet');
      badgedWallet.badges.push('comeback trader');
    }
    // Final cleanup - remove duplicates and ensure one hit wonder is removed if multiple runners
    if (runnerCount > 1) {
      badgedWallet.badges = badgedWallet.badges.filter(b => b !== 'one hit wonder');
    }
    badgedWallet.badges = [...new Set(badgedWallet.badges)];
    // --- Calculate token scores, wallet score, and PnL ---
    let totalWalletBuyValue = 0;
    let totalWalletSellValue = 0;
    for (const runner of badgedWallet.runners) {
      if (runner.scored) {
        (runner.transactions?.buy || []).forEach(buy => {
          totalWalletBuyValue += (buy.amount || 0) * (buy.price || 0);
        });
        (runner.transactions?.sell || []).forEach(sell => {
          totalWalletSellValue += (sell.amount || 0) * (sell.price || 0);
        });
        continue;
      }
      (runner.transactions?.buy || []).forEach(buy => {
        totalWalletBuyValue += (buy.amount || 0) * (buy.price || 0);
      });
      (runner.transactions?.sell || []).forEach(sell => {
        totalWalletSellValue += (sell.amount || 0) * (sell.price || 0);
      });
      const hasBuys = runner.transactions?.buy && runner.transactions.buy.length > 0;
      const hasSells = runner.transactions?.sell && runner.transactions.sell.length > 0;
      if (hasBuys && !hasSells) {
        runner.score = 2;
        runner.scored = true;
        continue;
      }
      if (isPotentialSandwichBot(runner, sandwichConfig)) {
        if (!badgedWallet.badges.includes('bot')) {
          badgedWallet.badges.push('bot');
        }
      }
      const earlyBuyPoints = computeEarlyBuyPoints(runner);
      const holdingMultiplier = computeHoldingMultiplier(runner);
      const convictionBonus = computeConvictionBonus(runner);
      const earlyExitPenalty = computeEarlyExitPenalty(runner);
      const baseScore = earlyBuyPoints * holdingMultiplier * convictionBonus;
      const finalTokenScore = baseScore * (1 - earlyExitPenalty);
      runner.score = isNaN(finalTokenScore) ? 0 : finalTokenScore;
      runner.scored = true;
    }
    badgedWallet.pnl = totalWalletSellValue - totalWalletBuyValue;
    if (isNaN(badgedWallet.pnl)) badgedWallet.pnl = 0;
    const sumTokenScores = badgedWallet.runners.reduce((acc, r) => acc + (r.score || 0), 0);
    let boughtBelowCount = 0;
    let successCount = 0;
    const nowSecWallet = Math.floor(Date.now() / 1000);
    for (const runner of badgedWallet.runners) {
      const tEarly = runner.timestamps?.early; const tLate = runner.timestamps?.late;
      if (tEarly == null || tLate == null) continue;
      const anyBuyEarly = runner.transactions?.buy?.some(b => b.timestamp != null && b.timestamp <= tEarly);
      if (!anyBuyEarly) continue;
      boughtBelowCount++;
      let heldPastLate = false;
      const runnerHasSells = runner.transactions?.sell && runner.transactions.sell.length > 0;
      if (!runnerHasSells) { if (nowSecWallet > tLate) heldPastLate = true; }
      else { if (runner.transactions.sell.some(s => s.timestamp != null && s.timestamp > tLate)) heldPastLate = true; }
      if (heldPastLate) successCount++;
    }
    const successRate = boughtBelowCount > 0 ? (successCount / boughtBelowCount) * 100 : 0;
    let walletMultiplier = 0.5;
    if (successRate >= 50) walletMultiplier = 1.5;
    else if (successRate >= 20) walletMultiplier = 1.2;
    else if (successRate >= 10) walletMultiplier = 1.0;
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
    return await finalizeWallet(badgedWallet);
  }

  // Save to DB and cleanup
  async function finalizeWallet(wallet) {
    for (const runner of wallet.runners) {
      if (runner.timestamps && runner.timestamps.hasOwnProperty('allprices')) delete runner.timestamps.allprices;
      if (typeof runner.score !== 'number' || isNaN(runner.score)) runner.score = 0;
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
      console.error(`Error saving wallet ${wallet}:`, err);
      return null;
    }
  }

  // Run the pool
  const results = await promisePool(convertedWallets, processWallet, concurrencyLimit);
  const processed = results.filter(Boolean);
  console.log(`Database operations complete. Processed data for ${processed.length}/${convertedWallets.length} wallets.`);
}

module.exports = scoreWallets;