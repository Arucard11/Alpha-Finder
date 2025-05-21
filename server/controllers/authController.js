const {getWhitelist} = require('../DB/querys.js')

exports.getWhitelist = async(req,res) =>{
    try{
        const {address} = req.params

        let whitelist = await getWhitelist()
    
        if(whitelist.some(wallet => wallet.wallet_address === address)){
            if(whitelist.find(w => w.wallet_address === address).name === "admin"){
                return res.json({ isWhitelisted: true, isAdmin: true }) 
            }else{
                return res.json({ isWhitelisted: true, isAdmin: false }) 
            }
        }else{
            return res.json({ isWhitelisted: false, isAdmin: false }) 
        }

    }catch(e){
        console.log("error getting whitelist")
        res.status(400).end()
    }

}