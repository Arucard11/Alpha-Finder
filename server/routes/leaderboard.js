// routes/leaderboard.js
const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const runnerStats = require('../controllers/runnerStatsController')

// GET /leaderboard/all-time
router.get('/all-time', leaderboardController.getAllTimeLeaderboard);

// GET /leaderboard/dynamic (for 7-day, 30-day, 90-day, etc.)
router.get('/dynamic', leaderboardController.getDayLeaderboard);

// POST /leaderboard/lookup
router.post('/lookup', leaderboardController.lookupAddress);

// GET runner statistics
router.get('/runner-stats', runnerStats.getRunnerStats);

module.exports = router;
