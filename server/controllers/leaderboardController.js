const { getWalletsSorted, getWalletsDynamic } = require('../DB/querys.js');

require("dotenv").config();
const NodeCache = require('node-cache');

// Create a cache instance with a default TTL (in seconds)
const cache = new NodeCache({ stdTTL: 3200 }); // Cache expires after 200 seconds

// Controller for all-time high leaderboard
exports.getAllTimeLeaderboard = async (req, res) => {
  try {
    // Extract offset and the new sort parameter from the request body
    // Provide default values if they are missing
    const offset = parseInt(req.body.offset, 10) || 0; // Default offset to 0 if missing/invalid
    const sort = req.body.sort || 'confidence'; // Default sort to 'confidence' if missing

    // Validate sort parameter if necessary (optional, depends on security needs)
    const validSorts = ['confidence', 'pnl', 'runners'];
    if (!validSorts.includes(sort)) {
        console.warn(`Invalid sort parameter received: ${sort}. Defaulting to 'confidence'.`);
        sort = 'confidence'; // Or return a 400 Bad Request error
        // return res.status(400).json({ error: 'Invalid sort parameter specified.' });
    }

    // Construct a unique cache key incorporating both sort criteria and offset
    const cacheKey = `allTimeLeaderboard_${sort}_${offset}`;

    // Check if the data exists in the cache
    if (cache.has(cacheKey)) {
      console.log(`Cache hit for all-time leaderboard (sort: ${sort}, offset: ${offset})`);
      // The data in cache is already the correct page (limit 50, starting at offset)
      // **No need to slice again here**
      return res.json(cache.get(cacheKey));
    }

    // If not in cache, fetch data from the database using the generalized function
    console.log(`Cache miss for all-time leaderboard (sort: ${sort}, offset: ${offset}). Fetching from DB...`);
    // Pass the sort criteria to the database function
    const topWallets = await getWalletsSorted(offset, sort);

    console.log(`Fetched ${topWallets.length} wallets from DB.`);

    // Cache the result (which is already the correct page) for future requests
    // Use the dynamic cache key
    cache.set(cacheKey, topWallets); // Cache the exact data returned by the DB query

    // Send the fetched data (which is already the correct page)
    // **No need to slice again here**
    res.json(topWallets);

  } catch (error) {
    // Log the specific context of the error
    console.error(`Error fetching all-time leaderboard (sort: ${req.body.sort}, offset: ${req.body.offset}):`, error);
    res.status(500).json({ error: 'Internal Server Error' }); // Send a JSON error response
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
