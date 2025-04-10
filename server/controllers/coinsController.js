require("dotenv").config()
const {getAllRunners,getRunnerByAddress} = require('../DB/querys.js')

exports.getCoins = async(req,res) =>{
   let runner = await getRunnerByAddress(req.params.address)
   res.json(runner.timestamps.allprices)
}