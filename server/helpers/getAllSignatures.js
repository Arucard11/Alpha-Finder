const axios = require("axios");
const dotenv = require("dotenv")
dotenv.config()
const fs = require("fs")
const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`

async function getAllSignatures(address){

    let before
    let allSignatures = []
    
    while(allSignatures.length <= 100000){
        try{
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "id": "1",
              "jsonrpc": "2.0",
              "method": "getSignaturesForAddress",
              "params": [
                  address,{before:before, commitment:"finalized"}
                ]
            }),
        });
        const data = await response.json();
        console.log("Result length",data.result.length)
        console.log("last sig in the result",data.result[data.result.length-1].signature)
        before = data.result[data.result.length-1].signature
        allSignatures = allSignatures.concat(data.result)
        console.log(allSignatures.length)
        if(data.result.length < 1000){
            return allSignatures
        }
        
    }catch(e){
        console.log(e)
        }
    }

    return allSignatures


}

// getAllSignatures("4h26eponcR8jc3N3EuQZ72ZCpurpGoszvFgGiekTpump")


async function getTransaction(signature){
    const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "jsonrpc": "2.0",
          "id": 1,
          "method": "getTransaction",
          "params": [
            signature,
            {maxSupportedTransactionVersion:0,encoding:"jsonParsed"}
          ]
        }),
    });
    
    const data = await response.json();
    return data.result
    

}



function isBuyTransaction(parsedTx, tokenMint) {
    if (!parsedTx || !parsedTx.meta) {
      throw new Error("Invalid transaction object");
    }
  
    // Extract pre- and post-token balances
    const preBalances = parsedTx.meta.preTokenBalances || [];
    const postBalances = parsedTx.meta.postTokenBalances || [];
  
    // Helper: get pre balance for a given account (or assume 0 if not present)
    const getPreBalance = (accountIndex, mint) => {
      const entry = preBalances.find(b => b.accountIndex === accountIndex && b.mint === mint);
      return entry && entry.uiTokenAmount && entry.uiTokenAmount.amount
        ? BigInt(entry.uiTokenAmount.amount)
        : BigInt(0);
    };
  
    // Check each post balance for the target token mint.
    // If any account shows an increase (post > pre), consider it a buy.
    for (const postEntry of postBalances) {
      if (postEntry.mint === tokenMint) {
        const postAmount = BigInt(postEntry.uiTokenAmount.amount);
        const preAmount = getPreBalance(postEntry.accountIndex, tokenMint);
        if (postAmount > preAmount) {
          return true; // Increase in token balance => buy
        }
      }
    }
    return false;
  }

// getTransaction("2vFypn8Q8KYVcxpLCHndrewPCaVcbmHVxLqdMovdfQ5jUfNP2hfkbbvtq4TQYMQ2GcVNY22TCoj7TpAh2J43td6e")