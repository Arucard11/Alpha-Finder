const getAccountInfo = require("./getAccountInfo.js")
const findTimestampLimit = require("./findTimestampLimit.js")
const dotenv = require("dotenv")
dotenv.config()

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Function to fetch SOL price from CoinGecko

async function fetchAth(address){
    try {

        // Get the current timestamp (now) in seconds
        const now = Math.floor(Date.now() / 1000);

        // Get the timestamp for 30 days ago (30 * 24 * 60 * 60 seconds)
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

        const options = {
            method: 'GET',
            headers: {
              accept: 'application/json',
              'x-chain': 'solana',
              'X-API-KEY': `${process.env.BIRDEYE_API_KEY}`
            }
          };

        // fetch all prices for coin in the last 30 days 
        const res = await fetch(`https://public-api.birdeye.so/defi/history_price?address=${address}&address_type=token&time_from=${thirtyDaysAgo}&time_to=${now}&type=1m`, options)
        const priceInfo = await res.json()
        console.log("price info",priceInfo)
        
        if(priceInfo?.data?.items){
            // get the all time high price for the coin within the last thirty days
            const athprice = priceInfo.data.items.reduce((acc,curr)=>{
                                    return Math.max(acc,curr.value)  
                             },-Infinity)
                            
            
            //get token supply
            const {supply,decimals} = await getAccountInfo(address)
            const tokenSupply = Number(supply) / Math.pow(10,decimals);
            const athMarketCap = Number((tokenSupply * athprice).toFixed(0))
            let timestamps = await findTimestampLimit(tokenSupply,priceInfo.data.items.sort((a, b) => a.unixTime - b.unixTime),athprice)
            timestamps.allprices = priceInfo.data.items
            return {athMarketCap,athprice,timestamps}             
        }else{
            return {athMarketCap:"0",athprice:"0"}
        }
    } catch (error) {
        console.error("Error fetching transactions:", error);
    }
}

module.exports = fetchAth

