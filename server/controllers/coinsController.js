require("dotenv").config()
const {getAllRunners} = require('../DB/querys.js')

exports.getCoins = async(req,res) =>{
   let runners =  await getAllRunners()
   res.json(runners)
}