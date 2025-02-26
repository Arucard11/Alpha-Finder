
 function convertWallet(earlyBuyers){
    let wallets = []

    for(coin of earlyBuyers){
        let {mintInfo:{address,name,symbol,logoUri,millionTimeStamps}} = coin
        for(let [wallet,transactions] of Object.entries(coin)){
            if(wallet === "mintInfo"){
                continue
            }
            let convertedWallet = wallets.find(w=> w.address === wallet)
            if(convertedWallet){
                convertedWallet.runners.push({address,name,symbol,logoUri,millionTimeStamps,transactions})
                continue
            }
            let walletObj = {}
            walletObj.address = wallet
            walletObj.runners = [{address,name,symbol,logoUri,millionTimeStamps,transactions}]
            wallets.push(walletObj)

        }

    }

}