const getAth = require("./getATH.js")
const getNewCoins = require("./getNewCoins.js")
const {addFiltered,getUncheckedRunners,getAllRunnerAddresses,addRunner} = require("../DB/querys.js")

function getUniqueFromFirst(arr1, arr2) {
    return arr1.filter(coin => !arr2.some(address => address === coin.address));
  }

async function getRunners(){
    
    
    try{
        const newCoins = await getNewCoins()
        const oldRunners = await getAllRunnerAddresses()
        const newRunners = getUniqueFromFirst(newCoins,oldRunners)

        for(let coin of newRunners){
           
            let {athMarketCap,athprice,timestamps} = await getAth(coin.address)
  
            if(athMarketCap >= 1000000){
                coin.athprice = athprice
                coin.timestamps = timestamps
                coin.athmc = athMarketCap
                console.log("ATH Market Cap: ",athMarketCap)
                console.log("ATH Price: ",athprice)
                    await addRunner(coin)   
            }else{
                // await addFiltered(coin)
            }
        }

        return await getUncheckedRunners()
     
      
    }catch(e){
        console.log(e)
    }
}

module.exports = getRunners;