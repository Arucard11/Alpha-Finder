const { getAllRunners, updateWallet, getAllWallets, addWallet,getWalletByAddress } = require('../DB/querys.js');
const { connection } = require('./connection.js');
const { PublicKey } = require('@solana/web3.js');

// Helper: calculates the percentage discount of lowerPrice relative to originalPrice.
function percentageLower(originalPrice, lowerPrice) {
  const difference = originalPrice - lowerPrice;
  return (difference / originalPrice) * 100;
}

// Helper to count runners that held past the holding threshold.
function totalRunnersHeldPastMillion(runners) {
  let total = 0;
  for (let runner of runners) {
    if (runner.transactions.sell.some(sell => sell.timestamp > runner.millionTimeStamp)) {
      total++;
    }
  }
  return total;
}

// Wallet helper: checks if the wallet is inactive (dead) for over 30 days.
const checkIfDeadWallet = async (address) => {
  let latestSig = (await connection.getSignaturesForAddress(new PublicKey(address), { limit: 100 }))[0];
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;
  if (latestSig && latestSig.blockTime < thirtyDaysAgo) {
    return true;
  }
};

// Wallet helper: checks if the wallet qualifies as a comeback trader.
const checkIfComebackTrader = async (address) => {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;
  let signatures = await connection.getSignaturesForAddress(new PublicKey(address), { limit: 100 });
  let total = 0;
  for (let sig of signatures) {
    if (sig.blockTime < thirtyDaysAgo) {
      total++;
    }
  }
  if (total >= 50) {
    return true;
  }
};

async function scoreWallets(convertedWallets) {
  // Merge in any additional wallets from the DB.
 

  let badged = [];
  let runners = await getAllRunners();

  // --- Badge Awarding (same as before) ---
  for (let wallet of convertedWallets) {
    if (wallet.runners.length >= 10) { // legendary buyer badge
      if (wallet.badges.includes("one hit wonder")) {
        wallet.badges = wallet.badges.filter(badge => badge !== "one hit wonder");
      }
      wallet.badges.push("legendary buyer");
    } else if ((wallet.runners.length / runners.length) * 100 >= 20) { // potential alpha badge
      if (wallet.badges.includes("one hit wonder")) {
        wallet.badges = wallet.badges.filter(badge => badge !== "one hit wonder");
      }
      wallet.badges.push("potential alpha");
    } else if (wallet.runners.some(runner => runner.transactions.sell.some(sell => sell.timestamp > runner.millionTimeStamp))) { // high conviction badge
      if (wallet.badges.includes("one hit wonder")) {
        wallet.badges = wallet.badges.filter(badge => badge !== "one hit wonder");
      }
      wallet.badges.push("high conviction");
    } else if ((wallet.runners.length / runners.length) * 100 <= 20 && (wallet.runners.length / runners.length) * 100 >= 10) { // mid trader badge
      wallet.badges.push("mid trader");
    } else if ((wallet.runners.length / runners.length) * 100 <= 10) { // degen sprayer badge
      if (wallet.badges.includes("one hit wonder")) {
        wallet.badges = wallet.badges.filter(badge => badge !== "one hit wonder");
      }
      wallet.badges.push("degen sprayer");
    } else if (wallet.runners.length === 1) { // one hit wonder badge
      wallet.badges.push("one hit wonder");
    } else if (totalRunnersHeldPastMillion(wallet.runners) >= 2) { // diamond hands badge
      if (wallet.badges.includes("one hit wonder")) {
        wallet.badges = wallet.badges.filter(badge => badge !== "one hit wonder");
      }
      wallet.badges.push("diamond hands");
    } else if (wallet.runners.some(runner => runner.transactions.buy.some(b => b.amount * b.price >= 5000))) { // whale buyer badge
      wallet.badges.push("whale buyer");
    } else if (await checkIfDeadWallet(wallet.address)) { // dead wallet badge
      wallet.badges.push("dead wallet");
    } else if (await checkIfComebackTrader(wallet.address)) { // comeback trader badge
      if (wallet.badges.includes("dead wallet")) {
        wallet.badges = wallet.badges.filter(badge => badge !== "dead wallet");
      }
      wallet.badges.push("comeback trader");
    }

    // Remove duplicate badges.
    wallet.badges = [...new Set(wallet.badges)];
    badged.push(wallet);
  }

  // --- Token-Level Scoring Helpers ---
  // Computes Early Buy Points based on the best discount among buy transactions.
  function computeEarlyBuyPoints(runner) {
    let bestDiscount = 0;
    for (let buy of runner.transactions.buy) {
      // Convert athprice from string to number.
      let discount = percentageLower(parseFloat(runner.athprice), buy.price);
      if (discount > bestDiscount) bestDiscount = discount;
    }
    // New thresholds: if discount is ≥75% (buy price under 25% of ATH) award 5 points.
    if (bestDiscount >= 75) return 5;
    else if (bestDiscount >= 50) return 4;
    else if (bestDiscount >= 25) return 3;
    else return 2;
  }

  // Determines the Holding Multiplier and Conviction Bonus based on how long the token was held.
  function computeHoldingAndConviction(runner) {
    let holdingMultiplier = 1.0;
    let convictionBonus = 1.0;
    // Get earliest buy time.
    let buyTimes = runner.transactions.buy.map(b => b.timestamp);
    let earliestBuy = Math.min(...buyTimes);
    // Define expected holding duration (in seconds) using the millionTimeStamp.
    let thresholdDuration = runner.millionTimeStamp - earliestBuy;

    if (runner.transactions.sell.length > 0) {
      // Evaluate each sell transaction to find the best holding duration ratio.
      let bestRatio = 0;
      for (let sell of runner.transactions.sell) {
        let duration = sell.timestamp - earliestBuy;
        let ratio = duration / thresholdDuration;
        if (ratio > bestRatio) bestRatio = ratio;
      }
      // Holding Multiplier rules:
      // 1.5x: ratio >= 5, 1.2x: ratio >= 2, 1.0x: ratio >= 1, else 0.7x.
      if (bestRatio >= 5) {
        holdingMultiplier = 1.5;
      } else if (bestRatio >= 2) {
        holdingMultiplier = 1.2;
      } else if (bestRatio >= 1) {
        holdingMultiplier = 1.0;
      } else {
        holdingMultiplier = 0.7;
      }
      // Conviction Bonus rules for sold tokens:
      // 1.2x: ratio >= 2, 1.0x: ratio >= 1, else 0.8x.
      if (bestRatio >= 2) {
        convictionBonus = 1.2;
      } else if (bestRatio >= 1) {
        convictionBonus = 1.0;
      } else {
        convictionBonus = 0.8;
      }
    } else {
      // Never sold: determine bonus based on recent activity.
      let latestBuy = Math.max(...runner.transactions.buy.map(b => b.timestamp));
      const currentTimeSec = Date.now() / 1000;
      if (currentTimeSec - latestBuy <= 90 * 24 * 60 * 60) {
        convictionBonus = 1.5;
      } else {
        convictionBonus = 1.2;
      }
      // No sale means no adjustment to the holding multiplier.
      holdingMultiplier = 1.0;
    }
    return { holdingMultiplier, convictionBonus };
  }

  // Computes Early Exit Penalty based on the fraction of tokens sold.
  function computeEarlyExitPenalty(runner) {
    if (runner.transactions.sell.length > 0) {
      let totalBought = runner.transactions.buy.reduce((acc, curr) => acc + curr.amount, 0);
      let totalSold = runner.transactions.sell.reduce((acc, curr) => acc + curr.amount, 0);
      let soldFraction = (totalSold / totalBought) * 100;
      if (soldFraction < 25) return 0.40;
      else if (soldFraction < 50) return 0.30;
      else return 0;
    }
    return 0;
  }

  // --- Token-Level Scoring ---
  for (let wallet of badged) {
    for (let runner of wallet.runners) {
      if (runner.scored) continue; // Skip if already scored

      const earlyBuyPoints = computeEarlyBuyPoints(runner);
      const { holdingMultiplier, convictionBonus } = computeHoldingAndConviction(runner);
      const earlyExitPenalty = computeEarlyExitPenalty(runner);

      // Corrected Token Score formula:
      // Token Score = (Early Buy Points x Holding Multiplier x Conviction Bonus) x (1 - Early Exit Penalty)
      const tokenScore = (earlyBuyPoints * holdingMultiplier * convictionBonus) * (1 - earlyExitPenalty);
      runner.score = tokenScore;
      runner.scored = true;
    }

    // Sum token scores for the wallet.
    const sumTokenScores = wallet.runners.reduce((acc, curr) => acc + (isNaN(curr.score) ? 0 : curr.score), 0);

    // --- Wallet-Level Scoring ---
    // Success Rate: count tokens that were held past the holding threshold.
    let successCount = 0;
    const currentTimeSec = Date.now() / 1000;
    for (let runner of wallet.runners) {
      let heldPast = false;
      if (runner.transactions.sell.length > 0) {
        if (runner.transactions.sell.some(sell => sell.timestamp > runner.millionTimeStamp)) {
          heldPast = true;
        }
      } else {
        // For never-sold tokens, if current time is past the holding threshold, consider them as held.
        if (currentTimeSec > runner.millionTimeStamp) {
          heldPast = true;
        }
      }
      if (heldPast) successCount++;
    }
    const totalTokens = wallet.runners.length;
    const successRate = totalTokens > 0 ? (successCount / totalTokens) * 100 : 0;

    // Determine Wallet-Specific Success Rate Multiplier.
    let walletMultiplier = 1.0;
    if (successRate >= 50) walletMultiplier = 1.5;
    else if (successRate >= 20) walletMultiplier = 1.2;
    else if (successRate >= 10) walletMultiplier = 1.0;
    else walletMultiplier = 0.5;

    // Determine the wallet's last activity timestamp across all runner transactions.
    let lastActivity = 0;
    for (let runner of wallet.runners) {
      const buyTimes = runner.transactions.buy.map(b => b.timestamp);
      const sellTimes = runner.transactions.sell.map(s => s.timestamp);
      const maxRunnerTime = Math.max(...buyTimes.concat(sellTimes));
      if (maxRunnerTime > lastActivity) lastActivity = maxRunnerTime;
    }

    // Calculate Decay Factor: starts after 30 days of inactivity; 2% per week of inactivity (beyond 30 days).
    const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;
    let decay = 0;
    if (currentTimeSec - lastActivity > THIRTY_DAYS_SEC) {
      const inactiveTime = currentTimeSec - lastActivity - THIRTY_DAYS_SEC;
      const weeksInactive = Math.floor(inactiveTime / (7 * 24 * 60 * 60));
      decay = sumTokenScores * (weeksInactive * 0.02);
    }

    // Wallet Confidence Score = (Sum of Token Scores x Wallet Success Multiplier) - Decay Factor.
    wallet.confidence_score = (sumTokenScores * walletMultiplier) - decay;
  }

  // Update the wallets in the database.
  for (let wallet of badged) {
    try {
      if (wallet.id) {
        await updateWallet(wallet.id, 'runners', wallet.runners);
        await updateWallet(wallet.id, 'confidence_score', wallet.confidence_score);
        await updateWallet(wallet.id, 'badges', wallet.badges);
      } else {
        await addWallet(wallet);
      }
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = scoreWallets;
