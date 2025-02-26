const axios = require("axios")
const dotenv = require("dotenv")
dotenv.config()
const { connection } = require("../helpers/connection")
const { PublicKey} = require("@solana/web3.js")
const  {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token")
const borsh = require("borsh")

const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`

 const  getBondingCurves = (mint_account)=>{
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("bonding-curve"),  
        mint_account.toBuffer()
      ],  
      PUMP_FUN_PROGRAM);
    const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
      [
        bondingCurve.toBuffer(), 
        TOKEN_PROGRAM_ID.toBuffer(),
        mint_account.toBuffer(), 
      ], 
      ASSOCIATED_TOKEN_PROGRAM_ID);
      return {bondingCurve,associatedBondingCurve}
  }

async function isBonded(address){
  const schema = { 'struct': { 
    'discriminator': 'u64',
    'virtualTokenReserves': 'u64', 
    'virtualSolReserves': "u64", 
    'realTokenReserves': 'u64', 
    'realSolReserves': 'u64',
    'tokenTotalSupply':'u64',
            'complete':'bool'
        } };
        
        try {
            address = new PublicKey(address)
            const {bondingCurve} = getBondingCurves(address)
            
            // Fetch bonding curve account data
            const accountInfo = await connection.getAccountInfo(new PublicKey(bondingCurve));
            if (!accountInfo?.data) return 0;
        
            // Deserialize account data
            const {complete} = borsh.deserialize(
              schema,
              accountInfo.data
            );
        
          
            return complete
          } catch (error) {
            console.log(error)
            return false
          }
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
      
      
      let newCoins = []
      for (let coin of filtered){
        if(coin.address.slice(-4) === "pump"){
            const bonded = await isBonded(coin.address)
            if (bonded){
              console.log("Bonded")
              newCoins.push(coin)
            }else{
              console.log("not Bonded")
            }
        }else{
          newCoins.push(coin)
        }
      }
      return newCoins.length
}

getAllNewCoins().then((coins)=>console.log(coins))
module.exports = getAllNewCoins