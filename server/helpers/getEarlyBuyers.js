const cleanUpEarlyBuyers = require("./cleanUpEarlyBuyers.js");
const dotenv = require("dotenv");
dotenv.config();

async function getTxsByTime(address) {
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-chain': 'solana',
      'X-API-KEY': `${process.env.BIRDEYE_API_KEY}`
    }
  };
  
  let offset = 0;
  let more = true;
  let allTxs = [];

  while (more) {
    try {
      if (offset >= 50050) {
        more = false;
        return allTxs;
      }
      
      let res = await fetch(`https://public-api.birdeye.so/defi/txs/token?address=${address}&offset=${offset}&limit=50&tx_type=swap&sort_type=desc`, options);
      let data = await res.json();
      
      if (data?.data?.items === undefined) {
        console.log("Unexpected data format at offset", offset, data, address);
        more = false;
        return allTxs;
      }
      if (data.data?.items?.length < 50) {
        more = false;
      }
      offset += 50;
      allTxs = allTxs.concat(data.data?.items);
      
    } catch (e) {
      console.error("Error fetching transactions:", e);
      more = false;
    }
  }
 
  return allTxs;
}

async function getEarlyBuyers(coin) {
  const { address, name, symbol, logouri, athprice, timestamps } = coin;
  let secondCheck = true
  // Debug: Log coin and timestamp info.
  console.log("Coin info:", { address, name, symbol, athprice, timestamps });
  
  let allTxs = await getTxsByTime(address);
  console.log(`Total transactions fetched: ${allTxs.length}`);
  
  // Debug: Print a sample of transactions.
  if (allTxs.length > 0) {
    console.log("Sample transaction:", allTxs[0]);
  }
  
  // Filter for early transactions.
  let earlyBuyers = allTxs.filter(tx => tx.blockUnixTime < timestamps.early  );
  console.log(`Transactions before timestamps.early (${timestamps.early}): ${earlyBuyers.length}`);
  
  // If no transactions are found using the early cutoff, try the late cutoff.
  if(earlyBuyers.length === 0) {
    earlyBuyers = allTxs
    console.log(`Transactions before timestamps.late : ${earlyBuyers.length}`);
    secondCheck = false
  }
  
  // Group transactions by owner.
  earlyBuyers = earlyBuyers.reduce((acc, curr) => {
    // Ensure curr.owner exists.
    if (!curr.owner) {
      console.warn("Transaction missing owner:", curr);
      return acc;
    }
    if (acc[curr.owner]) {
      if (curr.side === "buy") {
        acc[curr.owner].buy.push({
          amount: curr.to.uiAmount,
          price: curr.to.nearestPrice,
          timestamp: curr.blockUnixTime
        });
      } else {
        acc[curr.owner].sell.push({
          amount: curr.from.uiAmount,
          price: curr.from.nearestPrice,
          timestamp: curr.blockUnixTime
        });
      }
    } else {
      acc[curr.owner] = { buy: [], sell: [] };
      if (curr.side === "buy") {
        acc[curr.owner].buy.push({
          amount: curr.to.uiAmount,
          price: curr.to.nearestPrice,
          timestamp: curr.blockUnixTime
        });
      } else {
        acc[curr.owner].sell.push({
          amount: curr.from.uiAmount,
          price: curr.from.nearestPrice,
          timestamp: curr.blockUnixTime
        });
      }
    }
    return acc;
  }, { mintInfo: { address, name, symbol, logouri, timestamps, athprice} });

  console.log("After grouping by owner:", earlyBuyers);

  earlyBuyers = cleanUpEarlyBuyers(earlyBuyers);
  console.log("After cleanUpEarlyBuyers:", earlyBuyers);

  // Add later transactions to each early buyer.
  if(secondCheck){
    allTxs.filter(tx => tx.blockUnixTime > timestamps.early).forEach(tx => {
      if (earlyBuyers[tx.owner]) {
        if (tx.side === "buy") {
          earlyBuyers[tx.owner].buy.push({
            amount: tx.to.uiAmount,
            price: tx.to.nearestPrice,
            timestamp: tx.blockUnixTime
          });
          earlyBuyers[tx.owner].buy = earlyBuyers[tx.owner].buy.sort((a, b) => new Date(b.timestamp * 1000) - new Date(a.timestamp * 1000));
        } else {
          earlyBuyers[tx.owner].sell.push({
            amount: tx.from.uiAmount,
            price: tx.from.nearestPrice,
            timestamp: tx.blockUnixTime
          });
          earlyBuyers[tx.owner].sell = earlyBuyers[tx.owner].sell.sort((a, b) => new Date(b.timestamp * 1000) - new Date(a.timestamp * 1000));
        }
      }
    });
  }

  console.log("Done processing one coin.");
  return earlyBuyers;
}

module.exports = getEarlyBuyers;
