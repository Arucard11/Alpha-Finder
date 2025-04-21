require("dotenv").config()
const {getAllRunners,getRunnerByAddress} = require('../DB/querys.js')

exports.getCoins = async(req,res) =>{
  try {
    const runner = await getRunnerByAddress(req.params.address);
    if (!runner) {
      // If runner not found, return a 404 with a JSON error message
      return res.status(404).json({ error: 'Runner not found' });
    }
    // Check if timestamps and allprices exist before accessing
    if (runner.timestamps && runner.timestamps.allprices) {
      res.json(runner.timestamps.allprices);
    } else {
      // Handle case where runner exists but data is missing
      console.error(`Missing timestamps or allprices for runner: ${req.params.address}`);
      res.status(500).json({ error: 'Price data not available for this runner' });
    }
  } catch (error) {
    // Catch any other unexpected errors
    console.error(`Error fetching price data for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Internal server error fetching price data' });
  }
}