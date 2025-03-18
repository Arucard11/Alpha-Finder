const { getAllRunners, updateWallet, addWallet } = require('../DB/querys.js');
const { connection } = require('./connection.js');
const { PublicKey } = require('@solana/web3.js');

/**
 * Helper to find the closest price in `allprices` given a target timestamp.
 * (Retained for backward compatibility if needed.)
 */
function getClosestPrice(allprices, targetUnixTime) {
  if (!Array.isArray(allprices) || allprices.length === 0) return null;
  let closest = allprices[0];
  let minDiff = Math.abs(closest.unixTime - targetUnixTime);
  for (let i = 1; i < allprices.length; i++) {
    const diff = Math.abs(allprices[i].unixTime - targetUnixTime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = allprices[i];
    }
  }
  return closest.value || null;
}

/**
 * Wallet helper: checks if the wallet is inactive (dead) for over 30 days.
 */
async function checkIfDeadWallet(address) {
  // Retrieve up to 100 signatures for the address.
  const signatures = await connection.getSignaturesForAddress(
    new PublicKey(address),
    { limit: 100 }
  );

  // If no signatures are found, you might decide what to return.
  if (!signatures.length) {
    // For example, if no signatures, you might consider it not dead.
    return false;
  }
  
  // Sort the signatures array from newest to oldest by blockTime.
  // (Assuming blockTime is in seconds, we compare directly.)
  signatures.sort((a, b) => b.blockTime - a.blockTime);

  // Get the newest signature.
  const latestSig = signatures[0];

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;

  // If blockTime is in seconds, convert it to milliseconds.
  const latestSigTimeMs = latestSig.blockTime * 1000;

  // Return true if the latest signature occurred before the cutoff.
  return latestSigTimeMs < thirtyDaysAgo;
}


/**
 * Wallet helper: checks if the wallet qualifies as a comeback trader (inactive 60+ days, then returns).
 */
async function checkIfComebackTrader(address) {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;
  const signatures = await connection.getSignaturesForAddress(new PublicKey(address), { limit: 100 });
  let total = 0;
  for (const sig of signatures) {
    if (sig.blockTime < thirtyDaysAgo) {
      total++;
    }
  }
  return total >= 50;
}

/**
 * Returns the unixTime of the first price entry from runner.timestamps.allprices.
 */
function getStartTime(runner) {
  if (runner.timestamps && Array.isArray(runner.timestamps.allprices) && runner.timestamps.allprices.length > 0) {
    return runner.timestamps.allprices[0].unixTime;
  }
  return null;
}

/**
 * Returns how many runners are held past the 'late' threshold.
 * A runner is considered held past if there is at least one sell transaction after runner.timestamps.late.
 */
function totalRunnersHeldPastLate(runners) {
  let total = 0;
  for (const runner of runners) {
    if (
      runner.timestamps &&
      runner.timestamps.late &&
      runner.transactions.sell.some(s => s.timestamp > runner.timestamps.late)
    ) {
      total++;
    }
  }
  return total;
}

/**
 * Main scoring function using timestamp‐based calculations.
 * Uses:
 *   - runner.timestamps.early: Buy threshold time (buys before this are “early”)
 *   - runner.timestamps.late: Holding threshold time (sells after this are “held”)
 *   - runner.timestamps.twoMillion / fiveMillion: times the runner hit those market caps
 * Missing timestamps are handled gracefully.
 */
async function scoreWallets(convertedWallets) {
  const allRunners = await getAllRunners();
  let badged = [];

  // =====================
  //   BADGE ASSIGNMENT (unchanged)
  // =====================
  for (const wallet of convertedWallets) {
    const runnerCount = wallet.runners.length;
    const globalRunnerCount = allRunners.length;
    
    // 1) Legendary Buyer
    if (runnerCount >= 10) {
      wallet.badges = wallet.badges.filter(b => b !== 'one hit wonder');
      wallet.badges.push('legendary buyer');
    }
    // 2) Potential Alpha
    else if ((runnerCount / globalRunnerCount) * 100 >= 5 && (runnerCount / globalRunnerCount) * 100 <= 9) {
      wallet.badges = wallet.badges.filter(b => b !== 'one hit wonder');
      wallet.badges.push('potential alpha');
    }
    // 3) High Conviction
    else if (
      wallet.runners.some(runner =>
        runner.transactions.sell.some(sell =>
          runner.timestamps && runner.timestamps.twoMillion && sell.timestamp > runner.timestamps.twoMillion
        )
      )
    ) {
      wallet.badges = wallet.badges.filter(b => b !== 'one hit wonder');
      wallet.badges.push('high conviction');
    }
    // 4) Mid Trader
    else if ((runnerCount / globalRunnerCount) * 100 <= 4 && (runnerCount / globalRunnerCount) * 100 >= 2) {
      wallet.badges = wallet.badges.filter(b => b !== 'one hit wonder');
      wallet.badges.push('mid trader');
    }
    // 5) Degen Sprayer
    else if ((runnerCount / globalRunnerCount) * 100 <= 1) {
      wallet.badges = wallet.badges.filter(b => b !== 'one hit wonder');
      wallet.badges.push('degen sprayer');
    }
    // 6) One-Hit Wonder
    else if (runnerCount === 1) {
      wallet.badges.push('one hit wonder');
    }
    // 7) Diamond Hands (multiple runners held past 'late')
    else if (totalRunnersHeldPastLate(wallet.runners) >= 2) {
      wallet.badges = wallet.badges.filter(b => b !== 'one hit wonder');
      wallet.badges.push('diamond hands');
    }
    // 8) Whale Buyer
    else if (
      wallet.runners.some(runner =>
        (runner.transactions.buy.some(b => b.amount * b.price >= 5000)) ||
        (runner.transactions.sell.some(s => s.amount * s.price >= 5000))
      )
    ) {
      wallet.badges.push('whale buyer');
    }
    // 9) Dead Wallet
    else if (await checkIfDeadWallet(wallet.address)) {
      wallet.badges.push('dead wallet');
    }
    // 10) Comeback Trader
    else if (await checkIfComebackTrader(wallet.address)) {
      wallet.badges = wallet.badges.filter(b => b !== 'dead wallet');
      wallet.badges.push('comeback trader');
    }

    if(wallet.runners.length > 1 && wallet.badges.some(b => b === 'one hit wonder')){
      wallet.badges = wallet.badges.filter(b => b !== 'one hit wonder');
    }
    wallet.badges = [...new Set(wallet.badges)];
    badged.push(wallet);
  }

  // =========================
  //  TOKEN-LEVEL SCORING (TIMESTAMP-BASED)
  // =========================

  // 1) Early Buy Points:
  // For each buy before runner.timestamps.early, compute the fraction relative to the period from the start time to the early threshold.
  // Award points: fraction ≥ 0.75 → 5, ≥ 0.50 → 4, ≥ 0.25 → 3, otherwise 2.
  // Additionally, if exactly one buy exists and its total value is less than $5, subtract 1 point.
  function computeEarlyBuyPoints(runner) {
    if (!runner.timestamps || runner.timestamps.early == null) return 2;
    const threshold = runner.timestamps.early;
    const startTime = getStartTime(runner);
    if (!startTime || threshold <= startTime) return 2;
    let bestPoints = 0;
    for (const buy of runner.transactions.buy) {
      let points = 2;
      if (buy.timestamp <= threshold) {
        const fraction = (threshold - buy.timestamp) / (threshold - startTime);
        if (fraction >= 0.75) {
          points = 5;
        } else if (fraction >= 0.50) {
          points = 4;
        } else if (fraction >= 0.25) {
          points = 3;
        } else {
          points = 2;
        }
      }
      bestPoints = Math.max(bestPoints, points);
    }
    if (runner.transactions.buy.length === 1) {
      const singleBuy = runner.transactions.buy[0];
      if (singleBuy.amount * singleBuy.price < 5) { // Changed threshold from $50 to $5
        bestPoints = Math.max(bestPoints - 1, 1);
      }
    }
    return bestPoints > 0 ? bestPoints : 2;
  }

  // 2) Holding Multiplier:
  // Determines the multiplier based on sell timestamps compared to thresholds:
  //   - Sell at or after fiveMillion → 1.5
  //   - Else if sell at or after twoMillion → 1.2
  //   - Else if sell at or after late → 1.0
  //   - Otherwise, 0.7.
  function computeHoldingMultiplier(runner) {
    const tLate = runner.timestamps?.late;
    const tTwoMillion = runner.timestamps?.twoMillion;
    const tFiveMillion = runner.timestamps?.fiveMillion;
    let multiplier = 1.0;
    if (runner.transactions.sell && runner.transactions.sell.length > 0) {
      for (const sell of runner.transactions.sell) {
        if (tFiveMillion && sell.timestamp >= tFiveMillion) {
          multiplier = Math.max(multiplier, 1.5);
        } else if (tTwoMillion && sell.timestamp >= tTwoMillion) {
          multiplier = Math.max(multiplier, 1.2);
        } else if (tLate && sell.timestamp >= tLate) {
          multiplier = Math.max(multiplier, 1.0);
        } else {
          multiplier = Math.max(multiplier, 0.7);
        }
      }
    } else {
      multiplier = 1.0;
    }
    return multiplier;
  }

  // 3) Conviction Bonus:
  // For never-sold runners:
  //   - Normally, if latest buy is within 90 days, bonus = 1.5; otherwise, bonus = 1.2.
  //   - However, if the highest buy value is less than $5, bonus is reduced to 1.0.
  // For sold runners, choose the best bonus:
  //   - Sell at or after twoMillion → 1.2, at or after late → 1.0, else 0.8.
  function computeConvictionBonus(runner) {
    const tLate = runner.timestamps?.late;
    const tTwoMillion = runner.timestamps?.twoMillion;
    let bonus = 1.0;
    if (!runner.transactions.sell || runner.transactions.sell.length === 0) {
      const latestBuy = Math.max(...runner.transactions.buy.map(b => b.timestamp));
      const nowSec = Math.floor(Date.now() / 1000);
      // Check highest buy value among all buys
      const maxBuyValue = Math.max(...runner.transactions.buy.map(b => b.amount * b.price));
      if (maxBuyValue < 5) { // Changed threshold from $50 to $5
        bonus = 1.0;
      } else {
        bonus = (nowSec - latestBuy <= 90 * 24 * 60 * 60) ? 1.5 : 1.2;
      }
    } else {
      for (const sell of runner.transactions.sell) {
        let candidate = 0.8;
        if (tTwoMillion && sell.timestamp >= tTwoMillion) {
          candidate = 1.2;
        } else if (tLate && sell.timestamp >= tLate) {
          candidate = 1.0;
        } else {
          candidate = 0.8;
        }
        bonus = Math.max(bonus, candidate);
      }
    }
    return bonus;
  }

  // 4) Early Exit Penalty:
  // For each sell occurring before runner.timestamps.late, compute:
  // fraction = (runner.timestamps.late - sell.timestamp) / (runner.timestamps.late - runner.timestamps.early)
  // Then assign:
  //   fraction > 0.75 → 40% penalty,
  //   fraction > 0.50 → 30% penalty,
  //   else 0%.
  // Return the minimal (i.e. best) penalty among sells.
  function computeEarlyExitPenalty(runner) {
    const tEarly = runner.timestamps?.early;
    const tLate = runner.timestamps?.late;
    if (!runner.transactions.sell || runner.transactions.sell.length === 0 || tEarly == null || tLate == null || tLate <= tEarly) {
      return 0;
    }
    let minPenalty = 1; // start high so we can reduce it
    for (const sell of runner.transactions.sell) {
      let penalty = 0;
      if (sell.timestamp < tLate) {
        const fraction = (tLate - sell.timestamp) / (tLate - tEarly);
        if (fraction > 0.75) {
          penalty = 0.40;
        } else if (fraction > 0.50) {
          penalty = 0.30;
        } else {
          penalty = 0;
        }
      } else {
        penalty = 0;
      }
      minPenalty = Math.min(minPenalty, penalty);
    }
    return minPenalty;
  }

  // =========================
  //  CALCULATE TOKEN SCORES
  // =========================
  for (const wallet of badged) {
    for (const runner of wallet.runners) {
      if (runner.scored) continue;
      const earlyBuyPoints = computeEarlyBuyPoints(runner);
      const holdingMultiplier = computeHoldingMultiplier(runner);
      const convictionBonus = computeConvictionBonus(runner);
      const earlyExitPenalty = computeEarlyExitPenalty(runner);
      // Token Score = (EarlyBuyPoints × HoldingMultiplier × ConvictionBonus) × (1 - EarlyExitPenalty)
      const tokenScore = (earlyBuyPoints * holdingMultiplier * convictionBonus) * (1 - earlyExitPenalty);
      runner.score = tokenScore;
      runner.scored = true;
    }
    const sumTokenScores = wallet.runners.reduce((acc, r) => acc + (isNaN(r.score) ? 0 : r.score), 0);

    // =========================
    //  WALLET-LEVEL SCORING
    // =========================

    // Success Rate:
    // For each runner, if any buy occurred before runner.timestamps.early, count it;
    // and if the runner was "held" (either never sold and current time > late, or any sell after late) count it as success.
    let boughtBelowCount = 0;
    let successCount = 0;
    for (const runner of wallet.runners) {
      if (!runner.timestamps || runner.timestamps.early == null || runner.timestamps.late == null) continue;
      const anyBuyEarly = runner.transactions.buy.some(b => b.timestamp <= runner.timestamps.early);
      if (!anyBuyEarly) continue;
      boughtBelowCount++;
      let heldPast = false;
      if (!runner.transactions.sell || runner.transactions.sell.length === 0) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec > runner.timestamps.late) heldPast = true;
      } else {
        if (runner.transactions.sell.some(s => s.timestamp > runner.timestamps.late)) {
          heldPast = true;
        }
      }
      if (heldPast) successCount++;
    }
    const successRate = boughtBelowCount > 0 ? (successCount / boughtBelowCount) * 100 : 0;
    let walletMultiplier = 1.0;
    if (successRate >= 50) {
      walletMultiplier = 1.5;
    } else if (successRate >= 20) {
      walletMultiplier = 1.2;
    } else if (successRate >= 10) {
      walletMultiplier = 1.0;
    } else {
      walletMultiplier = 0.5;
    }

    // Determine the wallet's last activity (max timestamp among all buys and sells)
    let lastActivity = 0;
    for (const runner of wallet.runners) {
      const buyTimes = runner.transactions.buy.map(b => b.timestamp);
      const sellTimes = runner.transactions.sell.map(s => s.timestamp);
      const maxTime = Math.max(...buyTimes.concat(sellTimes));
      if (maxTime > lastActivity) lastActivity = maxTime;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;
    let decay = 0;
    if (nowSec - lastActivity > THIRTY_DAYS_SEC) {
      const inactiveTime = nowSec - lastActivity - THIRTY_DAYS_SEC;
      const weeksInactive = Math.floor(inactiveTime / (7 * 24 * 60 * 60));
      decay = sumTokenScores * (weeksInactive * 0.02);
    }
    wallet.confidence_score = (sumTokenScores * walletMultiplier) - decay;
  }

  // =====================
  //   SAVE TO DATABASE
  // =====================
  for (const wallet of badged) {
    try {
      if (wallet.id) {
        await updateWallet(wallet.id, 'runners', wallet.runners);
        await updateWallet(wallet.id, 'confidence_score', wallet.confidence_score);
        await updateWallet(wallet.id, 'badges', wallet.badges);
      } else {
        await addWallet(wallet);
      }
    } catch (err) {
      console.error(err);
    }
  }
}

module.exports = scoreWallets;
