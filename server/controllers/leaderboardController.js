const {getAllWallets} = require('../DB/querys.js')
const filterTool = require('../helpers/filterTools.js')


// Controller for all-time high leaderboard
exports.getAllTimeLeaderboard = async (req, res) => {
  try {
    const unfiltered = await getAllWallets();
    res.json({ data: unfiltered });
  } catch (error) {
    console.error('Error fetching all-time leaderboard:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
  // Controller for 90-day leaderboard
  exports.get90DayLeaderboard = async(req, res) => {
    // Your logic to retrieve the 90-day leaderboard
    try{
      let unfiltered = await getAllWallets()
      let filtered = filterTool.getWalletsWithTransactionsWithin90Days(unfiltered)
  
      res.json({ data: filtered });

    }catch(e){
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  
  // Controller for 30-day leaderboard
  exports.get30DayLeaderboard = async(req, res) => {
    // Your logic to retrieve the 30-day leaderboard
    let unfiltered = await getAllWallets()
    let filtered = filterTool.getWalletsWithTransactionsWithin30Days(unfiltered)
    res.json({ data: filtered });
  };
  
  // Controller for 7-day leaderboard
  exports.get7DayLeaderboard = async(req, res) => {
    // Your logic to retrieve the 7-day leaderboard
    let unfiltered = await getAllWallets()
    let filtered = filterTool.getWalletsWithTransactionsWithin7Days(unfiltered)
    res.json({ data: filtered });
  };
  