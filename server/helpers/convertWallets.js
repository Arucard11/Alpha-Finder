const { getAllWallets, updateWallet, getWalletByAddress } = require("../DB/querys.js");

async function convertWallets(coin) {
  const wallets = [];
  
  // Destructure coin.mintInfo to use as a template for runner info.
  const { mintInfo } = coin;
  const { address, name, symbol, logouri, millionTimeStamp, athprice, timestamps, athmc, totalsupply } = mintInfo;
  
  // Group transactions by wallet address.
  // Each key (except "mintInfo") in the coin object represents a wallet address.
  const walletGroups = {};
  for (const [walletAddress, transactions] of Object.entries(coin)) {
    if (walletAddress === "mintInfo") continue;
    if (!walletGroups[walletAddress]) {
      walletGroups[walletAddress] = [];
    }
    walletGroups[walletAddress].push(transactions);
  }
  
  // Get all unique wallet addresses.
  const walletAddresses = Object.keys(walletGroups);
  
  // Process each wallet in parallel.
  const walletResults = await Promise.all(
    walletAddresses.map(async (walletAddress) => {
      // Fetch the wallet from the database.
      const oldWallet = await getWalletByAddress(walletAddress);
      
      // Build runner objects for each set of transactions for this wallet for the CURRENT coin.
      const newRunnersForCurrentCoin = walletGroups[walletAddress].map(transactions => {
        // 'address' here is the coin's mint address from mintInfo
        return { address, name, symbol, logouri, millionTimeStamp, transactions, athprice, timestamps, athmc, totalsupply };
      });
      
      if (oldWallet) {
        let shouldAddNewRunners = true;
        // Check if oldWallet.runners already contains a scored runner for the CURRENT coin (mintInfo.address)
        if (oldWallet.runners && oldWallet.runners.length > 0) {
          const existingScoredRunnerForCurrentCoin = oldWallet.runners.find(
            r => r.address === mintInfo.address && // Check if runner is for the same coin
                 r.score != null && typeof r.score === 'number' && !isNaN(r.score) // Check if it has a valid score
          );
          if (existingScoredRunnerForCurrentCoin) {
            console.log(`[convertWallets] Wallet ${walletAddress} already has a scored runner for coin ${mintInfo.address}. Skipping addition of new runner data for this coin.`);
            shouldAddNewRunners = false;
          }
        }

        if (shouldAddNewRunners) {
          // If the wallet already exists in the DB, append the new runners.
          oldWallet.runners = oldWallet.runners || [];
          oldWallet.runners.push(...newRunnersForCurrentCoin);
          console.log("[convertWallets] Using old wallet from DB: ", oldWallet.address, ", appended new runners for coin: ", mintInfo.address);
        } else {
          console.log("[convertWallets] Using old wallet from DB: ", oldWallet.address, ", new runners for coin: ", mintInfo.address, " were not appended as a scored version already exists.");
        }
        return oldWallet;
      } else {
        // Otherwise, create a new wallet object.
        const newWallet = {
          address: walletAddress,
          runners: newRunnersForCurrentCoin,
          badges: []
        };
        console.log("Creating new wallet:", walletAddress);
        return newWallet;
      }
    })
  );
  
  return walletResults;
}

module.exports = convertWallets;
