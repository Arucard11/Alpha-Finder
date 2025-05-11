const getAth = require("./getATH.js")
const getNewCoins = require("./getNewCoins.js")
const {addFiltered,getUncheckedRunners,getAllRunnerAddresses,addRunner} = require("../DB/querys.js")

function getUniqueFromFirst(arr1, arr2) {
    return arr1.filter(coin => !arr2.some(address => address === coin.address));
  }

async function getRunners(){
    
    
    const newCoins = await getNewCoins()
    const oldRunners = await getAllRunnerAddresses()
    const newRunners = getUniqueFromFirst(newCoins,oldRunners)
    
    for(let coin of newRunners){
        try{
            let {athMarketCap,athprice,timestamps,tokenSupply} = await getAth(coin.address)
            if(athMarketCap >= 1000000){
                coin.athprice = athprice
                coin.timestamps = timestamps
                coin.athmc = athMarketCap
                coin.totalsupply = tokenSupply
                await addRunner(coin)   
            }else{
                // await addFiltered(coin)
            }
        }catch(e){
            console.log(e)
        }
    }

        return await getUncheckedRunners()
     
      
}

module.exports = getRunners;