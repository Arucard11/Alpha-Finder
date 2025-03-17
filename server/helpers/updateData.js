const getEarlyBuyers = require('./getEarlyBuyers.js');
const getRunners = require('./getRunners.js');
const convertWallets = require('./convertWallets.js');
const scoreWallets = require('./scoreWallets.js');   
const setUpDb = require('../DB/createTables.js');
const {updateRunner} = require("../DB/querys.js")

async function updateData(){
   
    try{
        // await setUpDb()
        let runners = await getRunners()
        
        if(runners.length === 0){
            console.log("DB is up to date!")
            return
        }
        for(let runner of runners){
            let earlyBuyers = await getEarlyBuyers(runner) 
            console.log("early buyers from main function",earlyBuyers)
            let wallets = await convertWallets(earlyBuyers)
            console.log("wallets from main function",wallets)
            await scoreWallets(wallets)
            await updateRunner(runner.id,"checked", true)
        }
        
    }catch(e){
        console.log(e)
    }
}

updateData()
module.exports = updateData;