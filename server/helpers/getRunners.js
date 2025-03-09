const getAth = require("./getATH.js")
const getNewCoins = require("./getNewCoins.js")
const {addFiltered,getAllFiltered,getAllRunners,addRunner} = require("../DB/querys.js")

function getUniqueFromFirst(arr1, arr2) {
    return arr1.filter(coin => !arr2.some(coin2 => coin2.address === coin.address));
  }

async function getRunners(){
    
    
    try{
        const oldRunners = await getAllRunners()
        const filtered = await getAllFiltered()
        const newCoins = await getNewCoins()
        const valid = getUniqueFromFirst(newCoins,filtered)
        const newRunners = getUniqueFromFirst(valid,oldRunners)

        for(let coin of newRunners){

            let {athMarketCap,athprice,timestamps} = await getAth(coin.address)
            
            if(athMarketCap >= 1000000){
                coin.athprice = athprice
                coin.timestamps = timestamps
                
                await addRunner(coin)
                
            }else{
                await addFiltered(coin)
            }
        }

        return (await getAllRunners()).filter(r => r.checked !== true)
     
      
    }catch(e){
        console.log(e)
    }
}

module.exports = getRunners;