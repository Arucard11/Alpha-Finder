const {getHighestConfidenceWallets,getWalletsDynamic} = require('../DB/querys.js')
const filterTool = require('../helpers/filterTools.js')
require("dotenv").config()

// Controller for all-time high leaderboard
exports.getAllTimeLeaderboard = async (req, res) => {
  try {
    const {offset} = req.body 
    const topWallets = await getHighestConfidenceWallets(offset)
    
    res.json(topWallets)

  } catch (error) {
    console.error('Error fetching all-time leaderboard:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
  // Controller for 90-day leaderboard
  exports.getDayLeaderboard = async(req, res) => {
    // Your logic to retrieve the 90-day leaderboard
    try{
      const {days, offset,sort} = req.body
      const wallets = await getWalletsDynamic(days,offset,sort)
      console.log(wallets)
      res.json(wallets)
    }catch(e){
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  

  