const {getAllRunners,updateRunner,getAllWallets, deleteWalletById} = require('../DB/querys')


const sandwichConfig = {
    minTotalTransactions: 4,
    timeThresholdSeconds: 60,
    amountThresholdPercent: 0.30,
    minSandwichPairs: 1
};

/**
 * Helper function to detect potential sandwich bot behavior for a specific runner.
 */
function isPotentialSandwichBot(runner, config) {
    const buys = runner.transactions?.buy || [];
    const sells = runner.transactions?.sell || [];
    const totalTransactions = buys.length + sells.length;

    if (totalTransactions < config.minTotalTransactions) return false;

    const allTxns = [
        ...buys.map(tx => ({ ...tx, type: 'buy', usd_value: (tx.amount || 0) * (tx.price || 0), timestamp: tx.timestamp })),
        ...sells.map(tx => ({ ...tx, type: 'sell', usd_value: (tx.amount || 0) * (tx.price || 0), timestamp: tx.timestamp }))
    ];

    const validTxns = allTxns.filter(tx => typeof tx.timestamp === 'number' && !isNaN(tx.timestamp));
    validTxns.sort((a, b) => a.timestamp - b.timestamp);

    let sandwichPairCount = 0;
    for (let i = 0; i < validTxns.length - 1; i++) {
        const currentTx = validTxns[i];
        const nextTx = validTxns[i + 1];

        if (currentTx.type === nextTx.type) continue;

        const timeDiff = nextTx.timestamp - currentTx.timestamp;
        if (timeDiff > config.timeThresholdSeconds || timeDiff < 0) continue;

        if (currentTx.usd_value > 0 && nextTx.usd_value > 0) {
            const absValueDiff = Math.abs(nextTx.usd_value - currentTx.usd_value);
            const relativeDiff = absValueDiff / currentTx.usd_value;
            if (relativeDiff > config.amountThresholdPercent) continue;
        } else if (currentTx.usd_value === 0 && nextTx.usd_value === 0) {
             continue; // Cannot compare amounts if both zero
        } else {
            continue; // One is zero, one isn't - not similar
        }

        sandwichPairCount++;
        if (sandwichPairCount >= config.minSandwichPairs) return true;
    }
    return sandwichPairCount >= config.minSandwichPairs;
}

async function removeMev(){
    
    let allWallets = await getAllWallets()
    for(let wallet of allWallets){
        for(runner of wallet.runners){
            if(isPotentialSandwichBot(runner, sandwichConfig)){
                console.log("Removing wallet: ", wallet.id, " for runner: ", runner.name)
                await deleteWalletById(wallet.id)
            }   
        }
    }
    
}

async function restartRunners(){
    getAllRunners().then((runners) => {
        runners.forEach((runner) => {
            
            updateRunner(runner.id,"checked",false).catch((err) => console.error(err));
        });
    })

}

removeMev().then(() => console.log("Removed MEV wallets"))