const {addFiltered,getAllFiltered} = require("../DB/querys.js")
const {connection} = require("./connection.js")
const getPumpSwapMints = require("./pumpfun/getPumpSwapMints.js")
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
    try{
      let res = await fetch(`https://public-api.birdeye.so/defi/v3/token/list?sort_by=liquidity&sort_type=desc&min_liquidity=35000&offset=${offset}&limit=100`, options)
      let data = await res.json()
      offset+=100
      if(data?.data?.items){
        allCoins = allCoins.concat(data.data.items)
      }

      if(data?.data?.items && data?.data?.items?.length < 100){
        more = false
      }
    }catch(e){
      console.log(e)
    }
  }
return allCoins
}

async function createdAt(address){
  const options = {method: 'GET', headers: {accept: 'application/json', 'x-chain': 'solana','X-API-KEY': `${process.env.BIRDEYE_API_KEY}`}};

  try{

    let res = await fetch(`https://public-api.birdeye.so/defi/token_creation_info?address=${address}`, options)
    const data = await res.json()

    if(data.data && data.success){
      return data.data.blockUnixTime 
    }else{
      console.log(typeof address)
      await addFiltered(address)
      console.log("might be an error getting the created date for the coin",address)
      return 0
    } 

  }catch(e){
    console.log(e)
  }
}

async function getAllNewCoins(){

      const now = new Date();
      let liquid = (await getLiquid())
      // .concat(await getPumpSwapMints())
      let filtered = await getAllFiltered()
      let valid = liquid.filter(coin => filtered.some(c => c.address === coin.address) === false)
      console.log("valid coins", valid.length)
      let newCoins = []

      for(let coin of valid){
          let address
          if(coin.address){
          address = coin.address
          }else address = coin
          
          
          // Check if the coin is in the list of coins from the API
          let created = await createdAt(address)
          const coinDate = new Date(created *1000);
          // Calculate the difference in days
          const diffDays = (now - coinDate) / (1000 * 60 * 60 * 24);
          
          
          if(diffDays <= 30){
            try{

                if(!coin.address){
                  
                  const response = await fetch(connection.rpcEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      jsonrpc: "2.0",
                      id: "test",
                      method: "getAsset",
                      params: { id: address }
                    })
                  });
                  
                  const { result } = await response.json();
                  
                  coin = {
                    symbol: result?.content?.metadata?.symbol || 'N/A',
                    name: result?.content?.metadata?.name || 'Unnamed',
                    logo_uri: result?.content?.files?.[0]?.uri || '',
                    address: coin
                  };
                }
              coin.created_at = coinDate.toISOString()
              newCoins.push(coin)
              console.log("new coin", coin.name, coin.address)
            }catch(e){
              console.log(e)
            }
          }else{
            try{
              await addFiltered(address)
            }catch(e){
              console.log("error adding filtered coin",e)
            }
        }
      }
      
console.log("new coins", newCoins.length)

 return newCoins
}



module.exports = getAllNewCoins