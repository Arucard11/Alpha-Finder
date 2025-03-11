const { getAllRunners, updateWallet, addWallet } = require('../DB/querys.js');
const { connection } = require('./connection.js');
const { PublicKey } = require('@solana/web3.js');

/**
 * Helper to find the closest price in `allprices` given a target timestamp.
 * This ensures we can handle cases where there is no exact match for runner.timestamps.early/late.
 */
function getClosestPrice(allprices, targetUnixTime) {
  if (!Array.isArray(allprices) || allprices.length === 0) return null;

  // Find the entry with the minimal absolute difference from targetUnixTime
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

// Wallet helper: checks if the wallet is inactive (dead) for over 30 days.
async function checkIfDeadWallet(address) {
  const latestSig = (await connection.getSignaturesForAddress(new PublicKey(address), { limit: 100 }))[0];
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;
  return (latestSig && latestSig.blockTime < thirtyDaysAgo);
}

// Wallet helper: checks if the wallet qualifies as a comeback trader (inactive 60+ days, then returns).
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
  // For example, if total >= 50 means "came back after 60+ days"? 
  // Adjust to your actual logic as needed. 
  return total >= 50;
}

/**
 * Returns how many runners are held past the 'late' threshold in the new data structure
 * for awarding the 'diamond hands' badge, etc.
 */
function totalRunnersHeldPastLate(runners) {
  let total = 0;
  for (const runner of runners) {
    // If there's a sell after `runner.timestamps.late`, consider it "held past late"
    // (You can interpret "held" however you prefer, e.g. never sold by that time.)
    if (runner.transactions.sell.some(s => s.timestamp > runner.timestamps.late)) {
      total++;
    }
  }
  return total;
}

/**
 * Main scoring function that uses the new data structure.
 * - runner.timestamps.early: Buy threshold time
 * - runner.timestamps.late: Holding threshold time
 * - runner.timestamps.allprices: array of { value, address, unixTime }
 * - runner.timestamps.twoMillion / fiveMillion if you want them for reference
 */
async function scoreWallets(convertedWallets) {
  // We do not merge with getAllWallets() to match your snippet exactly
  const allRunners = await getAllRunners();
  let badged = [];

  // =====================
  //   BADGE ASSIGNMENT
  // =====================
  for (const wallet of convertedWallets) {
    const runnerCount = wallet.runners.length;
    const globalRunnerCount = allRunners.length; // used for percentage-based badges

    // 1) Legendary Buyer
    if (runnerCount >= 10) {
      wallet.badges = wallet.badges.filter(b => b !== 'one hit wonder');
      wallet.badges.push('legendary buyer');
    }
    // 2) Potential Alpha
    else if ((runnerCount / globalRunnerCount) * 100 >= 4) {
      wallet.badges = wallet.badges.filter(b => b !== 'one hit wonder');
      wallet.badges.push('potential alpha');
    }
    // 3) High Conviction
    else if (
      wallet.runners.some(runner =>
        runner.transactions.sell.some(sell => sell.timestamp > runner.timestamps.late)
      )
    ) {
      wallet.badges = wallet.badges.filter(b => b !== 'one hit wonder');
      wallet.badges.push('high conviction');
    }
    // 4) Mid Trader
    else if (
      (runnerCount / globalRunnerCount) * 100 <= 20 &&
      (runnerCount / globalRunnerCount) * 100 >= 10
    ) {
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
        runner.transactions.buy.some(b => b.amount * b.price >= 5000)
      ) ||  wallet.runners.some(runner =>
        runner.transactions.sell.some(b => b.amount * b.price >= 5000)
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

    // Remove duplicates
    wallet.badges = [...new Set(wallet.badges)];
    badged.push(wallet);
  }

  // =========================
  //  TOKEN-LEVEL SCORING
  // =========================

  // Helper: get the buy threshold price from runner.timestamps.early
  function getBuyThresholdPrice(runner) {
    if (!runner.timestamps || !runner.timestamps.early) return null;
    return getClosestPrice(runner.timestamps.allprices, runner.timestamps.early);
  }

  // Helper: get the holding threshold price from runner.timestamps.late
  function getHoldingThresholdPrice(runner) {
    if (!runner.timestamps || !runner.timestamps.late) return null;
    return getClosestPrice(runner.timestamps.allprices, runner.timestamps.late);
  }

  // 1) Early Buy Points
  function computeEarlyBuyPoints(runner) {
    const buyThresholdPrice = getBuyThresholdPrice(runner);
    if (!buyThresholdPrice) {
      // Fallback: if no threshold price, just give a default
      return 2;
    }
    let bestPoints = 0;

    for (const buy of runner.transactions.buy) {
      const ratio = buy.price / buyThresholdPrice;
      let points = 2; // default
      if (ratio <= 0.25) {
        points = 5;
      } else if (ratio <= 0.50) {
        points = 4;
      } else if (ratio <= 0.75) {
        points = 3;
      } else {
        points = 2;
      }
      // Keep the best (highest) among all buys
      if (points > bestPoints) {
        bestPoints = points;
      }
    }
    return bestPoints > 0 ? bestPoints : 2; // ensure at least 2
  }

  // 2) Holding Multiplier & Conviction Bonus
  function computeHoldingAndConviction(runner) {
    const holdingThresholdPrice = getHoldingThresholdPrice(runner);
    let holdingMultiplier = 1.0;
    let convictionBonus = 1.0;

    // If never sold
    if (!runner.transactions.sell || runner.transactions.sell.length === 0) {
      // Check for recent buy activity
      const latestBuyTimestamp = Math.max(...runner.transactions.buy.map(b => b.timestamp));
      const nowSec = Math.floor(Date.now() / 1000);
      // Conviction Bonus
      if (nowSec - latestBuyTimestamp <= 90 * 24 * 60 * 60) {
        convictionBonus = 1.5;
      } else {
        convictionBonus = 1.2;
      }
      // Holding Multiplier stays at 1.0
      return { holdingMultiplier, convictionBonus };
    }

    // If sold, find the best (highest) sell price
    let bestSellPrice = 0;
    for (const sell of runner.transactions.sell) {
      if (sell.price > bestSellPrice) {
        bestSellPrice = sell.price;
      }
    }

    // Holding Multiplier
    if (holdingThresholdPrice) {
      if (bestSellPrice >= 5 * holdingThresholdPrice) {
        holdingMultiplier = 1.5;
      } else if (bestSellPrice >= 2 * holdingThresholdPrice) {
        holdingMultiplier = 1.2;
      } else if (bestSellPrice >= holdingThresholdPrice) {
        holdingMultiplier = 1.0;
      } else {
        holdingMultiplier = 0.7;
      }
    }

    // Conviction Bonus
    if (!holdingThresholdPrice) {
      // fallback
      convictionBonus = 1.0;
    } else {
      if (bestSellPrice >= 2 * holdingThresholdPrice) {
        convictionBonus = 1.2;
      } else if (bestSellPrice >= holdingThresholdPrice) {
        convictionBonus = 1.0;
      } else {
        convictionBonus = 0.8;
      }
    }

    return { holdingMultiplier, convictionBonus };
  }

  // 3) Early Exit Penalty
  function computeEarlyExitPenalty(runner) {
    // If no sells, no penalty
    if (!runner.transactions.sell || runner.transactions.sell.length === 0) {
      return 0;
    }
    // Compare bestSellPrice to holdingThresholdPrice
    const holdingThresholdPrice = getHoldingThresholdPrice(runner);
    if (!holdingThresholdPrice) {
      return 0; // fallback if we can't get threshold price
    }
    let bestSellPrice = 0;
    for (const sell of runner.transactions.sell) {
      if (sell.price > bestSellPrice) {
        bestSellPrice = sell.price;
      }
    }
    if (bestSellPrice < 0.25 * holdingThresholdPrice) {
      return 0.40; // 40% penalty
    } else if (bestSellPrice < 0.50 * holdingThresholdPrice) {
      return 0.30; // 30% penalty
    } else {
      return 0;
    }
  }

  // =========================
  //  CALCULATE TOKEN SCORES
  // =========================
  for (const wallet of badged) {
    for (const runner of wallet.runners) {
      if (runner.scored) continue;

      const earlyBuyPoints = computeEarlyBuyPoints(runner);
      const { holdingMultiplier, convictionBonus } = computeHoldingAndConviction(runner);
      const earlyExitPenalty = computeEarlyExitPenalty(runner);

      // Token Score = (EarlyBuyPoints × HoldingMultiplier × ConvictionBonus) × (1 - earlyExitPenalty)
      const tokenScore = (earlyBuyPoints * holdingMultiplier * convictionBonus) * (1 - earlyExitPenalty);
      runner.score = tokenScore;
      runner.scored = true;
    }

    // Sum up all token scores
    const sumTokenScores = wallet.runners.reduce((acc, r) => acc + (isNaN(r.score) ? 0 : r.score), 0);

    // =========================
    //  WALLET-LEVEL SCORING
    // =========================

    // 1) Success Rate
    // # of tokens "bought below buy threshold" AND "held past holding threshold"
    //   / total tokens "bought below buy threshold"
    let boughtBelowCount = 0;
    let successCount = 0;

    for (const runner of wallet.runners) {
      const buyThresholdPrice = getBuyThresholdPrice(runner);
      if (!buyThresholdPrice) {
        // If no threshold price, skip
        continue;
      }
      // Check if ANY buy was below buyThresholdPrice
      const anyBuyBelow = runner.transactions.buy.some(b => b.price < buyThresholdPrice);
      if (!anyBuyBelow) {
        continue; // doesn't count toward "bought below" tokens
      }
      boughtBelowCount++;

      // Check if "held past" => either no sells or sells after runner.timestamps.late
      let heldPast = false;
      if (!runner.transactions.sell || runner.transactions.sell.length === 0) {
        // never sold => if current time is past the runner.timestamps.late => consider held
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec > runner.timestamps.late) {
          heldPast = true;
        }
      } else {
        // if any sell is after runner.timestamps.late
        if (runner.transactions.sell.some(s => s.timestamp > runner.timestamps.late)) {
          heldPast = true;
        }
      }
      if (heldPast) {
        successCount++;
      }
    }

    const successRate = boughtBelowCount > 0 ? (successCount / boughtBelowCount) * 100 : 0;

    // 2) Wallet-Specific Success Rate Multiplier
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

    // 3) Decay Factor after 30 days inactivity (2% weekly)
    let lastActivity = 0;
    for (const runner of wallet.runners) {
      const buyTimes = runner.transactions.buy.map(b => b.timestamp);
      const sellTimes = runner.transactions.sell.map(s => s.timestamp);
      const maxTime = Math.max(...buyTimes.concat(sellTimes));
      if (maxTime > lastActivity) {
        lastActivity = maxTime;
      }
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;
    let decay = 0;
    if (nowSec - lastActivity > THIRTY_DAYS_SEC) {
      const inactiveTime = nowSec - lastActivity - THIRTY_DAYS_SEC;
      const weeksInactive = Math.floor(inactiveTime / (7 * 24 * 60 * 60));
      decay = sumTokenScores * (weeksInactive * 0.02);
    }

    // 4) Final Wallet Confidence Score
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
