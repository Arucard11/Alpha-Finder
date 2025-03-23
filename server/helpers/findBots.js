const {getAllWallets,updateWallet} = require('../DB/querys.js');


const findBots = async() =>{
    let bots = 0
    const wallets = await getAllWallets()
    console.log(wallets.length)
    for(let wallet of wallets){
        let count = 0
         for(runner of wallet.runners){
            if(runner.transactions.buy.length > 15){
                count++
            }
         }

         if(count/wallet.runners.length*100 >= 70){
            wallet.badges.push("bot")
            await updateWallet(wallet.id, "badges", wallet.badges)
            console.log("Bot found", wallet)
            console.log(bots++)
         }
    }

}

findBots()