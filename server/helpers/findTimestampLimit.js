const dotenv = require("dotenv");
dotenv.config();

/**
 * Returns early, maxProfitStart, maxProfitEnd, twoMillion, fiveMillion, tenMillion, and twentyMillion timestamps
 * for a coin's price history over the last 30 days.
 *
 * Note: The prices array is sorted with the oldest prices first.
 *
 * @param {number} tokenSupply - The maximum number of coins available.
 * @param {Array<Object>} prices - Array of price objects (each with keys: value, unixTime).
 * @param {number|string} athprice - The all time high price of the coin.
 * @returns {Object} An object with { early, maxProfitStart, maxProfitEnd, twoMillion, fiveMillion, tenMillion, twentyMillion } timestamps.
 */
async function findTimestampLimit(tokenSupply, prices, athprice) {
  // Ensure prices are sorted by time (oldest first)
  prices.sort((a, b) => a.unixTime - b.unixTime);

  // Convert athprice to a number if necessary.
  const ath = parseFloat(athprice);

  // Calculate the ATH market cap.
  const athMarketCap = ath * tokenSupply;

  // Define threshold percentages relative to ATH market cap.
  // Early timestamp: when market cap reaches about 10% of ATH cap (or 50% if initial is too early).
  // maxProfitStart timestamp: when market cap reaches about 50% * 1.3 (~65%) of ATH cap (or 70% * 1.3 if initial is too early).
  let earlyCapThreshold = 0.10 * athMarketCap;
  let maxProfitStartCapThreshold = 0.50 * 1.3 * athMarketCap; // Renamed from lateCapThreshold

  // Because the array is sorted oldest first, find the first price that meets the thresholds.
  let earlyEntry = prices.find(price => (price.value * tokenSupply) >= earlyCapThreshold);
  let maxProfitStartEntry = prices.find(price => (price.value * tokenSupply) >= maxProfitStartCapThreshold); // Renamed from lateEntry

  // Extract the timestamps (if found).
  let early = earlyEntry ? earlyEntry.unixTime : prices.find(price => (price.value * tokenSupply) >= 0.50 * athMarketCap)?.unixTime;
  let maxProfitStart = maxProfitStartEntry ? maxProfitStartEntry.unixTime : prices.find(price => (price.value * tokenSupply) >= 0.70 * 1.3 * athMarketCap)?.unixTime; // Renamed from late

  // If the early timestamp is among the oldest 11 entries,
  // assume the threshold is too low and adjust upward.
  if (prices.slice(0, 11).some(price => price.unixTime === early)) {
    earlyCapThreshold = 0.50 * athMarketCap;
    maxProfitStartCapThreshold = 0.70 * 1.3 * athMarketCap; // Adjusted threshold name
    earlyEntry = prices.find(price => (price.value * tokenSupply) >= earlyCapThreshold);
    maxProfitStartEntry = prices.find(price => (price.value * tokenSupply) >= maxProfitStartCapThreshold); // Adjusted threshold name
    early = earlyEntry ? earlyEntry.unixTime : early;
    maxProfitStart = maxProfitStartEntry ? maxProfitStartEntry.unixTime : maxProfitStart; // Renamed variable
  }

  // Find the timestamp for the ATH market cap.
  const athEntry = prices.find(price => price.value >= ath); // Assuming price.value is the coin price
  const athTimestamp = athEntry ? athEntry.unixTime : null;

  // Find maxProfitEnd: the first time after ATH timestamp when the market cap drops >= 20% from ATH MC.
  let maxProfitEnd = null;
  if (athTimestamp !== null) {
    const maxProfitEndThreshold = 0.80 * athMarketCap;
    const pricesAfterATH = prices.filter(price => price.unixTime > athTimestamp);
    const maxProfitEndEntry = pricesAfterATH.find(price => (price.value * tokenSupply) <= maxProfitEndThreshold);
    maxProfitEnd = maxProfitEndEntry ? maxProfitEndEntry.unixTime : null;
  }

  // Additional thresholds: absolute market cap thresholds.
  let twoMillionEntry = prices.find(price => (price.value * tokenSupply) >= 2000000);
  let fiveMillionEntry = prices.find(price => (price.value * tokenSupply) >= 5000000);
  let tenMillionEntry = prices.find(price => (price.value * tokenSupply) >= 10000000); // New
  let twentyMillionEntry = prices.find(price => (price.value * tokenSupply) >= 20000000); // New

  const twoMillion = twoMillionEntry ? twoMillionEntry.unixTime : null;
  const fiveMillion = fiveMillionEntry ? fiveMillionEntry.unixTime : null;
  const tenMillion = tenMillionEntry ? tenMillionEntry.unixTime : null; // New
  const twentyMillion = twentyMillionEntry ? twentyMillionEntry.unixTime : null; // New

 
  return { early, maxProfitStart, maxProfitEnd, twoMillion, fiveMillion, tenMillion, twentyMillion }; // Updated return
}

module.exports = findTimestampLimit;
