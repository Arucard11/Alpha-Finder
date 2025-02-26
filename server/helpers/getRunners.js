const getAth = require("./getATH.js")
const getNewCoins = require("./getNewCoins.js")

async function getRunners(){
    try{
        const newCoins = await getNewCoins()
        const runners = []

        for(let coin of newCoins){

            let {athMarketCap} = await getAth(coin.address)
            console.log(athMarketCap)
            if(Number(athMarketCap.replace(/,/g, '')) >= 1000000){
                runners.push(coin)
            }
        }

        console.log(runners.length)
    }catch(e){
        console.log(e)
    }
}

getRunners()