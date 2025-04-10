// routes/leaderboard.js
const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const runnerStats = require('../controllers/runnerStatsController')

// GET /leaderboard/all-time
router.post('/all-time', leaderboardController.getAllTimeLeaderboard);

// GET /leaderboard/90-day
router.post('/day', leaderboardController.getDayLeaderboard);

// POST /leaderboard/lookup
router.post('/lookup', leaderboardController.lookupAddress);

// GET runner statistics
router.get('/runner-stats', runnerStats.getRunnerStats);

module.exports = router;
