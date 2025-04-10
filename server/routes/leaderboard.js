// routes/leaderboard.js
const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const lookupController = require('../controllers/lookupController');

// GET /leaderboard/all-time
router.post('/all-time', leaderboardController.getAllTimeLeaderboard);

// GET /leaderboard/90-day
router.post('/day', leaderboardController.getDayLeaderboard);

// POST /leaderboard/lookup
router.post('/lookup', lookupController.lookup);

// GET runner statistics
router.get('/runner-stats', leaderboardController.getRunnerStats);

module.exports = router;
