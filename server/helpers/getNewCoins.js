const axios = require("axios")
const dotenv = require("dotenv")
dotenv.config()

async function getLiquid(){
  let offset = 0
  let more = true
  let allCoins = []

  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-chain': 'solana',
      'X-API-KEY': `${process.env.BIRDEYE_API_KEY}`
    }
  };
  while(more){
      let res = await fetch(`https://public-api.birdeye.so/defi/v3/token/list?sort_by=liquidity&sort_type=desc&min_liquidity=20000&offset=${offset}&limit=100`, options)
      let data = await res.json()
      offset+=100
      allCoins = allCoins.concat(data.data.items)
      if(data.data.items.length < 100){
        more = false
      }
  }
return allCoins
}

async function getAllNewCoins(){
     

     let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://api.jup.ag/tokens/v1/all',
        headers: { 
          'Accept': 'application/json'
        }
      };
      
      
      const res = await axios.request(config)
      const coins = res.data
      
      const now = new Date();

      let filtered = coins.filter((coin) => {
        // Ensure the coin has a created_at property
        if (!coin.created_at) return false;
        
        // Parse the created_at date string into a Date object
        const coinDate = new Date(coin.created_at);
        
        // Calculate the difference in days
        const diffDays = (now - coinDate) / (1000 * 60 * 60 * 24);
        
        // Return true if the coin was created within the last 30 days
        return diffDays <= 30 && coin.daily_volume > 10000 && coin.daily_volume !== null
      });
      
  let liquid = await getLiquid()
  let newCoins = filtered.filter(coin => liquid.some(coin2 => coin2.address === coin.address));    
  console.log(newCoins.length)
 return newCoins
}


module.exports = getAllNewCoins