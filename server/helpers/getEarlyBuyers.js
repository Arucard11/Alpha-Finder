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
  const { address, name, symbol, logouri, athprice, timestamps, athmc, totalsupply } = coin;
  let secondCheck = true
  const MIN_TRANSACTION_VALUE = 5; // $5 minimum
  
  let earlyTx = await getTxsByTime(address,timestamps.early,"before");

  let earlyBuyers = earlyTx.reduce((acc, curr) => {
    if (!curr.owner) {
      console.warn("Transaction missing owner:", curr);
      return acc;
    }

    let transactionValue = 0;
    let transactionData = null;

    if (curr.side === "buy" && curr.to) {
      transactionValue = (curr.to.uiAmount || 0) * (curr.to.nearestPrice || 0);
      if (transactionValue >= MIN_TRANSACTION_VALUE) {
        transactionData = {
          amount: curr.to.uiAmount,
          price: curr.to.nearestPrice,
          timestamp: curr.blockUnixTime
        };
      }
    } else if (curr.side === "sell" && curr.from) {
      transactionValue = (curr.from.uiAmount || 0) * (curr.from.nearestPrice || 0);
      if (transactionValue >= MIN_TRANSACTION_VALUE) {
        transactionData = {
          amount: curr.from.uiAmount,
          price: curr.from.nearestPrice,
          timestamp: curr.blockUnixTime
        };
      }
    }

    if (transactionData) { // Only proceed if the transaction is valid (>= $5)
      if (!acc[curr.owner]) {
        acc[curr.owner] = { buy: [], sell: [] };
      }
      if (curr.side === "buy") {
        acc[curr.owner].buy.push(transactionData);
      } else {
        acc[curr.owner].sell.push(transactionData);
      }
    }
    return acc;
  }, { mintInfo: { address, name, symbol, logouri, timestamps, athprice, athmc, totalsupply } });

  

  let allTxs = await getAllTxs(address);
  if(secondCheck){
    allTxs.filter(tran=> tran.blockUnixTime > timestamps.early).forEach(tx => {
      if (earlyBuyers[tx.owner]) { // Only add to wallets that are already in earlyBuyers
        let transactionValue = 0;
        let transactionData = null;

        if (tx.side === "buy" && tx.to) {
          transactionValue = (tx.to.uiAmount || 0) * (tx.to.nearestPrice || 0);
          if (transactionValue >= MIN_TRANSACTION_VALUE) {
            transactionData = {
              amount: tx.to.uiAmount,
              price: tx.to.nearestPrice,
              timestamp: tx.blockUnixTime
            };
          }
        } else if (tx.side === "sell" && tx.from) {
          transactionValue = (tx.from.uiAmount || 0) * (tx.from.nearestPrice || 0);
          if (transactionValue >= MIN_TRANSACTION_VALUE) {
            transactionData = {
              amount: tx.from.uiAmount,
              price: tx.from.nearestPrice,
              timestamp: tx.blockUnixTime
            };
          }
        }

        if (transactionData) {
          if (tx.side === "buy") {
            earlyBuyers[tx.owner].buy.push(transactionData);
            earlyBuyers[tx.owner].buy.sort((a, b) => b.timestamp - a.timestamp );
          } else {
            earlyBuyers[tx.owner].sell.push(transactionData);
            earlyBuyers[tx.owner].sell.sort((a, b) => b.timestamp - a.timestamp );
          }
        }
      }
    });
  }
  

  return earlyBuyers;
}

module.exports = getEarlyBuyers;
