const { getAllWallets, updateWallet, getWalletByAddress } = require("../DB/querys.js");

async function convertWallets(coin) {
  const wallets = [];
  
  // Destructure coin.mintInfo to use as a template for runner info.
  const { mintInfo } = coin;
  const { address, name, symbol, logouri, millionTimeStamp, athprice, timestamps,athmc } = mintInfo;
  
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
      
      // Build runner objects for each set of transactions for this wallet.
      const runners = walletGroups[walletAddress].map(transactions => {
        return { address, name, symbol, logouri, millionTimeStamp, transactions, athprice, timestamps,athmc };
      });
      
      if (oldWallet) {
        // If the wallet already exists in the DB, append the new runners.
        oldWallet.runners = oldWallet.runners || [];
        oldWallet.runners.push(...runners);
        console.log("Using old wallet from DB:", oldWallet.address);
        return oldWallet;
      } else {
        // Otherwise, create a new wallet object.
        const newWallet = {
          address: walletAddress,
          runners: runners,
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
