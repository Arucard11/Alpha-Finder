

async function cleanUpEarlyBuyers(earlyBuyers){
    
    for(let [wallet,transactions] of Object.entries(earlyBuyers)){
        if(wallet === "mintInfo"){
            continue
        }

        if(transactions.buy.length === 0){
            delete earlyBuyers[wallet]
            
            continue
        }

        let totalBuys = transactions.buy.reduce((acc,curr)=>{
                let amount = curr.amount * curr.price
                return acc+=amount
        })

        if(totalBuys <=50){
            delete earlyBuyers[wallet]
            
        }
    }
    
    return earlyBuyers
}

module.exports = cleanUpEarlyBuyers