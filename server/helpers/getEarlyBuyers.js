const cleanUpEarlyBuyers = require("./cleanUpEarlyBuyers.js");
const dotenv = require("dotenv");
dotenv.config();

async function getTxsByTime(address,early,when) {
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
  let url
  
  while (more) {
    url = when === "before" ? `https://public-api.birdeye.so/defi/txs/token/seek_by_time?address=${address}&offset=${offset}&limit=50&tx_type=swap&before_time=${early}` : `https://public-api.birdeye.so/defi/txs/token/seek_by_time?address=${address}&offset=${offset}&limit=50&tx_type=swap&after_time=${early}`
    try {
      let res = await fetch(url, options);
      let data = await res.json();
      if(!res.ok){
        more = false
        return allTxs
        
      }
      
      offset += 50;
      allTxs = allTxs.concat(data.data?.items);
      
      more = data.data.hasNext
    } catch (e) {
      console.error("Error fetching transactions:", e);
      more = false;
    }
  }
 
  return allTxs;
}


async function getAllTxs(address) {
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
      let res = await fetch(`https://public-api.birdeye.so/defi/txs/token?address=${address}&offset=${offset}&limit=50&tx_type=swap&sort_type=desc` , options);
      let data = await res.json();
      if(!res.ok){
        more = false
        return allTxs
        
      }
      
      offset += 50;
      allTxs = allTxs.concat(data.data?.items);
      
      more = data.data.hasNext
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
  
  let earlyTx = await getTxsByTime(address,timestamps.early,"before");
  console.log("transactions before early timestamp",earlyTx.length)

  let earlyBuyers = earlyTx.reduce((acc, curr) => {
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

  

  let allTxs = await getAllTxs(address);
  // Add later transactions to each early buyer.
  if(secondCheck){
    allTxs.filter(tran=> tran.blockUnixTime > timestamps.early).forEach(tx => {
      if (earlyBuyers[tx.owner]) {
        if (tx.side === "buy") {
          earlyBuyers[tx.owner].buy.push({
            amount: tx.to.uiAmount,
            price: tx.to.nearestPrice,
            timestamp: tx.blockUnixTime
          });
          earlyBuyers[tx.owner].buy = earlyBuyers[tx.owner].buy.sort((a, b) => b.timestamp - a.timestamp );
        } else {
          earlyBuyers[tx.owner].sell.push({
            amount: tx.from.uiAmount,
            price: tx.from.nearestPrice,
            timestamp: tx.blockUnixTime
          });
          earlyBuyers[tx.owner].sell = earlyBuyers[tx.owner].sell.sort((a, b) => b.timestamp - a.timestamp );
        }
      }
    });
  }
  

  let cleaned = cleanUpEarlyBuyers(earlyBuyers);
 
  return cleaned
}

module.exports = getEarlyBuyers;
