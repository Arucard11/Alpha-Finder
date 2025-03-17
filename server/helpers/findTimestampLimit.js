const dotenv = require("dotenv");
dotenv.config();

/**
 * Returns early, late, twoMillion, and fiveMillion timestamps for a coin’s price history over the last 30 days.
 *
 * Note: The prices array is sorted with the oldest prices first.
 *
 * @param {number} tokenSupply - The maximum number of coins available.
 * @param {Array<Object>} prices - Array of price objects (each with keys: value, unixTime).
 * @param {number|string} athprice - The all time high price of the coin.
 * @returns {Object} An object with { early, late, twoMillion, fiveMillion } timestamps.
 */
async function findTimestampLimit(tokenSupply, prices, athprice) {
  // Convert athprice to a number if necessary.
  const ath = parseFloat(athprice);

  // Calculate the ATH market cap.
  const athMarketCap = ath * tokenSupply;

  // Define threshold percentages relative to ATH market cap.
  // We now want the early timestamp to be when market cap reaches about 30% of ATH cap,
  // and the late timestamp to be when it reaches 30% * 1.3 (~39%) of ATH cap.
  let earlyCapThreshold = 0.10 * athMarketCap;
  let lateCapThreshold = 0.50* 1.3 * athMarketCap;

  // Because the array is sorted oldest first, find the first price that meets the thresholds.
  let earlyEntry = prices.find(price => (price.value * tokenSupply) >= earlyCapThreshold);
  let lateEntry  = prices.find(price => (price.value * tokenSupply) >= lateCapThreshold);

  // Extract the timestamps (if found).
  let early = earlyEntry ? earlyEntry.unixTime : null;
  let late  = lateEntry ? lateEntry.unixTime : null;

  // If the early timestamp is among the oldest 11 entries,
  // assume the threshold is too low and adjust upward.
  if (prices.slice(0, 5).some(price => price.unixTime === early)) {
    earlyCapThreshold = 0.20 * athMarketCap;
    lateCapThreshold  = 0.60 * 1.3 * athMarketCap;  // 40% and roughly 52%
    earlyEntry = prices.find(price => (price.value * tokenSupply) >= earlyCapThreshold);
    lateEntry  = prices.find(price => (price.value * tokenSupply) >= lateCapThreshold);
    early = earlyEntry ? earlyEntry.unixTime : early;
    late  = lateEntry ? lateEntry.unixTime : late;
  }

  // Additional thresholds: absolute market cap thresholds for 2 million and 5 million.
  let twoMillionEntry = prices.find(price => (price.value * tokenSupply) >= 2000000);
  let fiveMillionEntry = prices.find(price => (price.value * tokenSupply) >= 5000000);

  const twoMillion = twoMillionEntry ? twoMillionEntry.unixTime : null;
  const fiveMillion = fiveMillionEntry ? fiveMillionEntry.unixTime : null;

 
  return { early, late, twoMillion, fiveMillion };
}

module.exports = findTimestampLimit;
