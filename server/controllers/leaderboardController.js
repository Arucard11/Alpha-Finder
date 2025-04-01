const { getHighestConfidenceWallets, getWalletsDynamic } = require('../DB/querys.js');
const filterTool = require('../helpers/filterTools.js');
require("dotenv").config();
const NodeCache = require('node-cache');

// Create a cache instance with a default TTL (in seconds)
const cache = new NodeCache({ stdTTL: 3200 }); // Cache expires after 200 seconds

// Controller for all-time high leaderboard
exports.getAllTimeLeaderboard = async (req, res) => {
  try {
    const { offset } = req.body;
    // Construct a unique cache key based on the offset
    const cacheKey = `allTimeLeaderboard_${offset}`;

    // Check if the data exists in the cache
    if (cache.has(cacheKey)) {
      console.log("Cache hit for all-time leaderboard");
      return res.json(cache.get(cacheKey).slice(offset,50));
    }

    // If not in cache, fetch data from the database
    const topWallets = await getHighestConfidenceWallets(offset);
    console.log("All time request: cache miss");
    console.log(topWallets.length)
    // Slice the data as needed
    

    // Cache the result for future requests
    cache.set(cacheKey, topWallets);

    res.json(topWallets.slice(offset,50));
  } catch (error) {
    console.error('Error fetching all-time leaderboard:', error);
    res.status(500).end()
  }
};

// Controller for 90-day leaderboard
exports.getDayLeaderboard = async (req, res) => {
  try {
    const { days, offset, sort } = req.body;
    // Construct a unique cache key based on days, offset, and sort criteria
    const cacheKey = `dayLeaderboard_${days}_${offset}_${sort}`;

    // Check if the data exists in the cache
    if (cache.has(cacheKey)) {
      console.log("Cache hit for day leaderboard");
      return res.json(cache.get(cacheKey).slice(offset,50));
    }

    // If not in cache, fetch data from the database
    const wallets = await getWalletsDynamic(days, offset, sort);
    console.log("Request made to days filters: cache miss");
    
    // Slice the data as needed
    const result = wallets

    // Cache the result for future requests
    cache.set(cacheKey, result);

    res.json(result);
  } catch (e) {
    console.error('Error fetching day leaderboard:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
