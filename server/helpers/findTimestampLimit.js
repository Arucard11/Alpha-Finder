const getAccountInfo = require("./getAccountInfo.js")
const dotenv = require("dotenv")
dotenv.config()

async function findTimestampLimit(address){
    const now = Math.floor(Date.now() / 1000);

    // Get the timestamp for 30 days ago (30 * 24 * 60 * 60 seconds)
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    const price = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': `${process.env.BIRDEYE_API_KEY}`
        }
      };

    // fetch all prices for coin in the last 30 days 
    const response = await fetch(`https://public-api.birdeye.so/defi/history_price?address=${address}&address_type=token&time_from=${thirtyDaysAgo}&time_to=${now}&type=1m`, price)
    const priceInfo = await response.json()
    const {supply,decimals} = await getAccountInfo(address)
    const tokenSupply = Number(supply) / Math.pow(10,decimals);
    let prices = priceInfo.data.items.sort((a, b) => new Date(a.unixTime) - new Date(b.unixTime))
    let early
    let late
    for(let price of prices){
      
      if(price.value * tokenSupply >= 200000){
        // console.log("final Timestamp before 200k",price.unixTime)
        // console.log(num)
        early = price.unixTime
      }else if(price.value * tokenSupply >= 500000){
        late = price.unixTime
      }
      
    }
    return {early,late}
}

// findTimestampLimit("6zkZPeSVSynKoNgPjb6yCfJ5BFFro4gcKXuMrPtvpump")
module.exports = findTimestampLimit
