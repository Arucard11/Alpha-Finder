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
          // Only add runners for this coin if not already present
          // Prevent duplicate runners for the same coin
          const existingRunnerKeys = new Set(oldWallet.runners.map(r => r.address + JSON.stringify(r.transactions)));
          let addedNewRunnerForThisCoin = false;
          for (const newRunner of newRunnersForCurrentCoin) {
            const runnerKey = newRunner.address + JSON.stringify(newRunner.transactions);
            if (!existingRunnerKeys.has(runnerKey)) {
              oldWallet.runners.push(newRunner);
              addedNewRunnerForThisCoin = true;
            }
          }
          if(addedNewRunnerForThisCoin) {
            console.log("[convertWallets] Using old wallet from DB: ", oldWallet.address, ", appended new runners for coin: ", mintInfo.address);
          }
          // Log if wallet now has exactly 2 runners
          if (oldWallet.runners?.length === 2) {
            console.log(`[convertWallets] Wallet ${oldWallet.address} now has 2 runners: Symbols [${oldWallet.runners.map(r => r.symbol).join(', ')}]`);
          }
        } else {
          // Even if not adding new runners, ensure all previously scored runners are preserved
          oldWallet.runners = oldWallet.runners || [];
          console.log("[convertWallets] Using old wallet from DB: ", oldWallet.address, ", new runners for coin: ", mintInfo.address, " were not appended as a scored version already exists.");
        }
        // Log before returning oldWallet (kept from previous instructions)
        console.log(`[convertWallets] Wallet ${oldWallet.address} (old): Returning. Final runners count: ${oldWallet.runners?.length}. Runner coins: ${JSON.stringify(oldWallet.runners?.map(r => r.symbol))}`);
        return oldWallet;
      } else {
        // Otherwise, create a new wallet object.
        const newWallet = {
          address: walletAddress,
          runners: newRunnersForCurrentCoin,
          badges: []
        };
        return newWallet;
      }
    })
  );
  
  return walletResults;
}

module.exports = convertWallets;
