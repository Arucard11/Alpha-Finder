const findTimestampLimit = require("./findTimestampLimit.js")
const cleanUpEarlyBuyers = require("./cleanUpEarlyBuyers.js")
const dotenv = require("dotenv")
dotenv.config()

async function getEarlyBuyers(coin){
  const {address,name,symbol,logoUri} = coin
    const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': `${process.env.BIRDEYE_API_KEY}`
        }
      };
      
      let offset = 0
      let more = true
      let allTxs = []

      while(more){
          let res = await fetch(`https://public-api.birdeye.so/defi/txs/token?address=${coin}&offset=${offset}&limit=50&tx_type=swap&sort_type=desc`, options)
          let data = await res.json()
          offset += 50
          allTxs = allTxs.concat(data.data.items)
          if(data.data.items.length < 50){
              more = false
          }
          
      }
     
     const {early,late} = await findTimestampLimit(coin)

     //finds early buyers tx and gets wallets buy and sell transactions
     let earlyBuyers = allTxs.filter(tx=> tx.blockUnixTime < early).reduce((acc,curr)=>{
                            if(acc[curr.owner]){
                              if(curr.side === "buy"){
                                acc[curr.owner].buy.push({amount:curr.to.uiAmount,price:curr.to.nearestPrice,timestamp:curr.blockUnixTime})
                              }else{
                                acc[curr.owner].sell.push({amount:curr.from.uiAmount,price:curr.from.nearestPrice,timestamp:curr.blockUnixTime})
                              }
                            }else if(!acc[curr.owner]){
                                acc[curr.owner] = {buy:[],sell:[]}
                                if(curr.side === "buy"){
                                  acc[curr.owner].buy.push({amount:curr.to.uiAmount,price:curr.to.nearestPrice,timestamp:curr.blockUnixTime})
                                }else{
                                  acc[curr.owner].sell.push({amount:curr.from.uiAmount,price:curr.from.nearestPrice,timestamp:curr.blockUnixTime})
                                }
                            }

                            return acc
                      },{mintInfo:{address,name,symbol,logoUri,millionTimeStamps:late}})

          earlyBuyers = cleanUpEarlyBuyers(earlyBuyers) 
          //get later transactions by the early buyers to calculate the pnl
          allTxs.filter(tx=> tx.blockUnixTime > early).forEach(tx=>{
            if(earlyBuyers[tx.owner]){
              if(tx.side === "buy"){
                earlyBuyers[tx.owner].buy.push({amount:tx.to.uiAmount,price:tx.to.nearestPrice,timestamp:tx.blockUnixTime})
              }else{
                earlyBuyers[tx.owner].sell.push({amount:tx.from.uiAmount,price:tx.from.nearestPrice,timestamp:tx.blockUnixTime})
              }
            }
          })

    //  console.log(JSON.stringify(earlyBuyers))
     return earlyBuyers
}

module.exports = getEarlyBuyers