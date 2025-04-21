const { getWalletsSorted, getWalletsDynamic, getWalletByAddress, getRunnerByAddress, getWalletsContainingRunner } = require('../DB/querys.js');

require("dotenv").config();
const NodeCache = require('node-cache');

// Create a cache instance with a default TTL (in seconds)
const cache = new NodeCache({ stdTTL: 300 }); // Cache expires after 200 seconds

// Controller for all-time high leaderboard
exports.getAllTimeLeaderboard = async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sortBy || 'confidence';
    const badges = req.query.badges ? req.query.badges.split(',') : [];
    const excludeBots = req.query.excludeBots === 'true';
    const athmcThreshold = req.query.athmcThreshold ? parseInt(req.query.athmcThreshold) : null;

    console.log(`Leaderboard request received. Offset: ${offset}, SortBy: ${sortBy}, Badges: ${badges.join(',') || 'none'}, ExcludeBots: ${excludeBots}, ATHMC Threshold: ${athmcThreshold}`);

    const wallets = await getWalletsSorted(offset, sortBy, badges, excludeBots, athmcThreshold);
    res.json(wallets);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Controller for 90-day leaderboard
exports.getDayLeaderboard = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90; // Default to 90 days
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sortBy || 'confidence';
    const badges = req.query.badges ? req.query.badges.split(',') : [];
    const excludeBots = req.query.excludeBots === 'true';
    const athmcThreshold = req.query.athmcThreshold ? parseInt(req.query.athmcThreshold) : null;

    console.log(`Day leaderboard request received. Days: ${days}, Offset: ${offset}, SortBy: ${sortBy}, Badges: ${badges.join(',') || 'none'}, ExcludeBots: ${excludeBots}, ATHMC Threshold: ${athmcThreshold}`);

    const wallets = await getWalletsDynamic(days, offset, sortBy, badges, excludeBots, athmcThreshold);
    res.json(wallets);
  } catch (error) {
    console.error('Error fetching day leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.lookupAddress = async (req, res) => {
  try {
    const { address, offset } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // First check if it's a wallet
    const wallet = await getWalletByAddress(address);
    if (wallet) {
      return res.json({
        type: 'wallet',
        data: wallet
      });
    }

    // If not a wallet, check if it's a runner
    const runner = await getRunnerByAddress(address);
    if (runner) {
      // Get wallets containing this runner
      const wallets = await getWalletsContainingRunner(address, offset || 0);
      return res.json({
        type: 'runner',
        data: {
          runner,
          wallets
        }
      });
    }

    // If neither found
    return res.status(404).json({ error: 'Address not found' });

  } catch (error) {
    console.error('Error in lookupAddress:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Dynamic leaderboard based on recent activity
const getDynamicLeaderboard = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7; // Default to 7 days
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sortBy || 'confidence';
    const badges = req.query.badges ? req.query.badges.split(',') : [];
    const excludeBots = req.query.excludeBots === 'true';
    const athmcThreshold = req.query.athmcThreshold ? parseInt(req.query.athmcThreshold) : null;

    console.log(`Dynamic leaderboard request received. Days: ${days}, Offset: ${offset}, SortBy: ${sortBy}, Badges: ${badges.join(',') || 'none'}, ExcludeBots: ${excludeBots}, ATHMC Threshold: ${athmcThreshold}`);

    const wallets = await getWalletsDynamic(days, offset, sortBy, badges, excludeBots, athmcThreshold);
    res.json(wallets);
  } catch (error) {
    console.error('Error fetching dynamic leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


