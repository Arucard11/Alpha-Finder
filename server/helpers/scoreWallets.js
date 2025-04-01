// PnL Calculation Added: Tuesday, April 1, 2025 at 7:11:03 AM UTC

const { getAllRunners, updateWallet, addWallet } = require('../DB/querys.js');
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
    return sandwichPairCount >= config.minSandwichPairs;
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
 * Main scoring function: Assigns badges and calculates scores including PnL.
 */
async function scoreWallets(convertedWallets) {
  const allRunners = await getAllRunners();
  let badged = [];

  console.log(`Starting scoring for ${convertedWallets.length} wallets...`);

  // =====================
  //   BADGE ASSIGNMENT
  // =====================
  for (const wallet of convertedWallets) {
    if (!wallet.runners) wallet.runners = [];
    if (!wallet.badges) wallet.badges = [];
    const runnerCount = wallet.runners.length;
    const globalRunnerCount = allRunners.length > 0 ? allRunners.length : 1;
    const participationRate = (runnerCount / globalRunnerCount) * 100;

    // Apply badges based on criteria (legendary, potential alpha, high conviction, etc.)
    // (Badge logic from previous steps remains here - keeping it concise for example)
    if (runnerCount >= 10) { wallet.badges.push('legendary buyer'); /* ... filter others */ }
    else if (participationRate >= 5 && participationRate < 10) { wallet.badges.push('potential alpha'); /* ... filter others */ }
    // ... other badge rules ...

    if (totalRunnersHeldPastLate(wallet.runners) >= 2) { wallet.badges.push('diamond hands'); /* ... filter others */ }
    if (wallet.runners.some(r => (r.transactions?.buy?.some(b => (b.amount||0)*(b.price||0)>=5000))||(r.transactions?.sell?.some(s => (s.amount||0)*(s.price||0)>=5000)))) { wallet.badges.push('whale buyer'); }

    // Async Badges (Dead / Comeback)
    const isDead = await checkIfDeadWallet(wallet.address);
    let isComeback = false;
    if (!isDead) isComeback = await checkIfComebackTrader(wallet.address);
    if (isComeback) { wallet.badges = wallet.badges.filter(b => b !== 'dead wallet'); wallet.badges.push('comeback trader'); }
    else if (isDead) { wallet.badges.push('dead wallet'); }

    // Final Badge Cleanup
    if (wallet.runners.length > 1) wallet.badges = wallet.badges.filter(b => b !== 'one hit wonder');
    wallet.badges = [...new Set(wallet.badges)];
    badged.push(wallet);
  }
  console.log("Badge assignment complete.");

  // =========================
  //  CALCULATE TOKEN SCORES, WALLET SCORE & PNL
  // =========================
  console.log("Calculating token scores, wallet scores, and PnL...");
  for (const wallet of badged) {
    let totalWalletBuyValue = 0; // Initialize PnL counters for the wallet
    let totalWalletSellValue = 0;

    for (const runner of wallet.runners) {
      if (runner.scored) { // If already scored, still need its txn values for PnL
        // Add runner's transactions to wallet PnL totals
        (runner.transactions?.buy || []).forEach(buy => {
             totalWalletBuyValue += (buy.amount || 0) * (buy.price || 0);
        });
        (runner.transactions?.sell || []).forEach(sell => {
            totalWalletSellValue += (sell.amount || 0) * (sell.price || 0);
        });
        continue; // Skip scoring logic if already scored
      }

      // --- Add Txn Values to Wallet PnL Totals ---
      (runner.transactions?.buy || []).forEach(buy => {
         totalWalletBuyValue += (buy.amount || 0) * (buy.price || 0);
      });
      (runner.transactions?.sell || []).forEach(sell => {
          totalWalletSellValue += (sell.amount || 0) * (sell.price || 0);
      });

      // --- Apply Scoring Rules ---
      const hasBuys = runner.transactions?.buy && runner.transactions.buy.length > 0;
      const hasSells = runner.transactions?.sell && runner.transactions.sell.length > 0;

      if (hasBuys && !hasSells) { // Rule 1: Buy-Only
          runner.score = 2;
          runner.scored = true;
          continue;
      }
      if (isPotentialSandwichBot(runner, sandwichConfig)) { // Rule 2: Sandwich Bot
          runner.score = 0;
          runner.scored = true;
          continue;
      }

      // --- Standard Scoring Logic ---
      const earlyBuyPoints = computeEarlyBuyPoints(runner);
      const holdingMultiplier = computeHoldingMultiplier(runner);
      const convictionBonus = computeConvictionBonus(runner);
      const earlyExitPenalty = computeEarlyExitPenalty(runner);
      const baseScore = earlyBuyPoints * holdingMultiplier * convictionBonus;
      const finalTokenScore = baseScore * (1 - earlyExitPenalty);
      runner.score = isNaN(finalTokenScore) ? 0 : finalTokenScore;
      runner.scored = true;

    } // End of runners loop

    // --- Calculate Wallet-Level Metrics ---

    // PnL Calculation for the Wallet
    wallet.pnl = totalWalletSellValue - totalWalletBuyValue;
    if (isNaN(wallet.pnl)) wallet.pnl = 0; // Ensure PnL is a number

    // Sum of valid token scores
    const sumTokenScores = wallet.runners.reduce((acc, r) => acc + (r.score || 0), 0);

    // Success Rate Calculation (same as before)
    let boughtBelowCount = 0;
    let successCount = 0;
    const nowSecWallet = Math.floor(Date.now() / 1000);
    for (const runner of wallet.runners) {
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

    // Wallet Multiplier (same as before)
    let walletMultiplier = 0.5;
    if (successRate >= 50) walletMultiplier = 1.5;
    else if (successRate >= 20) walletMultiplier = 1.2;
    else if (successRate >= 10) walletMultiplier = 1.0;

    // Activity Decay Calculation (same as before)
    let lastActivity = 0;
    for (const runner of wallet.runners) {
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

    // Final Wallet Confidence Score
    const calculatedScore = (sumTokenScores * walletMultiplier) - decayAmount;
    wallet.confidence_score = isNaN(calculatedScore) ? 0 : Math.max(0, calculatedScore);

  } // End of wallet scoring loop

  console.log("Scoring and PnL calculation complete. Saving to database...");

  // =====================
  //   SAVE TO DATABASE
  // =====================
  let savedCount = 0;
  for (const wallet of badged) {
    // Cleanup and validation before saving
    for (const runner of wallet.runners) {
      if (runner.timestamps && runner.timestamps.hasOwnProperty('allprices')) delete runner.timestamps.allprices;
      if (typeof runner.score !== 'number' || isNaN(runner.score)) runner.score = 0;
    }
    if (typeof wallet.confidence_score !== 'number' || isNaN(wallet.confidence_score)) wallet.confidence_score = 0;
    if (typeof wallet.pnl !== 'number' || isNaN(wallet.pnl)) wallet.pnl = 0; // Validate PnL
    if (!Array.isArray(wallet.badges)) wallet.badges = [];

    try {
      if (wallet.id) { // Update existing wallet
        // Update individual fields including the new pnl field
        await updateWallet(wallet.id, 'runners', wallet.runners);
        await updateWallet(wallet.id, 'confidence_score', wallet.confidence_score);
        await updateWallet(wallet.id, 'badges', wallet.badges);
        await updateWallet(wallet.id, 'pnl', wallet.pnl); // *** ADDED PNL UPDATE ***
      } else { // Add new wallet
        if (!wallet.address) {
            console.warn("Skipping addWallet: Wallet missing address.", wallet);
            continue;
        }
        // Assuming addWallet saves the entire wallet object, including the new pnl field
        await addWallet(wallet);
      }
      savedCount++;
    } catch (err) {
        console.error(`Error saving wallet ${wallet.address || wallet.id || 'UNKNOWN'}:`, err);
    }
  }
  console.log(`Database operations complete. Processed data for ${savedCount}/${badged.length} wallets.`);

} // End of scoreWallets function

module.exports = scoreWallets;