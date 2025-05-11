const getEarlyBuyers = require('./getEarlyBuyers.js');
const getRunners = require('./getRunners.js');
const convertWallets = require('./convertWallets.js');
const scoreWallets = require('./scoreWallets.js');   
const setUpDb = require('../DB/createTables.js');
const {updateRunner} = require("../DB/querys.js")

async function updateData(){
   
    try{
        
        let runners = await getRunners()
        
        if(runners.length === 0){
            console.log("DB is up to date!")
            return
        }
        for(let i = 0; i < runners.length; i++){
            let runner = runners[i];
            let earlyBuyers = await getEarlyBuyers(runner) 
            let wallets = await convertWallets(earlyBuyers)
            console.log("wallets from main function",wallets)
            await scoreWallets(wallets)
            await updateRunner(runner.id,"checked", true)
            // Progress log
            console.log(`[Progress] Processed ${i + 1} of ${runners.length} runners (${(((i + 1) / runners.length) * 100).toFixed(1)}%)`);
        }
        
    }catch(e){
        console.log(e)
    }
}



module.exports = updateData;