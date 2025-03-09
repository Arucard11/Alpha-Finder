/**
 * Returns an array of wallets that have at least one transaction (buy or sell)
 * within the past 90 days.
 *
 * @param {Array<Object>} wallets - Array of wallet objects.
 * @returns {Array<Object>} Filtered wallets.
 */
function getWalletsWithTransactionsWithin90Days(wallets) {
    const nowSec = Date.now() / 1000;
    const ninetyDaysSec = 90 * 24 * 60 * 60;
    const cutoff = nowSec - ninetyDaysSec;
  
    return wallets.filter(wallet => {
      if (!Array.isArray(wallet.runners)) return false;
      // Check each runner for qualifying transactions.
      for (const runner of wallet.runners) {
        if (!runner.transactions) continue;
        if (Array.isArray(runner.transactions.buy)) {
          if (runner.transactions.buy.some(tx => tx.timestamp >= cutoff)) return true;
        }
        if (Array.isArray(runner.transactions.sell)) {
          if (runner.transactions.sell.some(tx => tx.timestamp >= cutoff)) return true;
        }
      }
      return false;
    });
  }
  
  /**
   * Returns an array of wallets that have at least one transaction (buy or sell)
   * within the past 30 days.
   *
   * @param {Array<Object>} wallets - Array of wallet objects.
   * @returns {Array<Object>} Filtered wallets.
   */
  function getWalletsWithTransactionsWithin30Days(wallets) {
    const nowSec = Date.now() / 1000;
    const thirtyDaysSec = 30 * 24 * 60 * 60;
    const cutoff = nowSec - thirtyDaysSec;
  
    return wallets.filter(wallet => {
      if (!Array.isArray(wallet.runners)) return false;
      for (const runner of wallet.runners) {
        if (!runner.transactions) continue;
        if (Array.isArray(runner.transactions.buy)) {
          if (runner.transactions.buy.some(tx => tx.timestamp >= cutoff)) return true;
        }
        if (Array.isArray(runner.transactions.sell)) {
          if (runner.transactions.sell.some(tx => tx.timestamp >= cutoff)) return true;
        }
      }
      return false;
    });
  }
  
  /**
   * Returns an array of wallets that have at least one transaction (buy or sell)
   * within the past 7 days.
   *
   * @param {Array<Object>} wallets - Array of wallet objects.
   * @returns {Array<Object>} Filtered wallets.
   */
  function getWalletsWithTransactionsWithin7Days(wallets) {
    const nowSec = Date.now() / 1000;
    const sevenDaysSec = 7 * 24 * 60 * 60;
    const cutoff = nowSec - sevenDaysSec;
  
    return wallets.filter(wallet => {
      if (!Array.isArray(wallet.runners)) return false;
      for (const runner of wallet.runners) {
        if (!runner.transactions) continue;
        if (Array.isArray(runner.transactions.buy)) {
          if (runner.transactions.buy.some(tx => tx.timestamp >= cutoff)) return true;
        }
        if (Array.isArray(runner.transactions.sell)) {
          if (runner.transactions.sell.some(tx => tx.timestamp >= cutoff)) return true;
        }
      }
      return false;
    });
  }

  module.exports = {
    getWalletsWithTransactionsWithin90Days,
    getWalletsWithTransactionsWithin30Days,
    getWalletsWithTransactionsWithin7Days,
  };