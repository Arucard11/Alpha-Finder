const {addWhitelist} = require('../DB/querys.js')

exports.addWhitelist = async(req,res) =>{
    try{
        console.log("whitelist added")
        await addWhitelist(req.body)
        res.status(200).end()
    }catch(e){
        res.status(400).end()
    }
}