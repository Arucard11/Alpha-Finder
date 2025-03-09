// routes/leaderboard.js
const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');

// GET /leaderboard/all-time
router.get('/all-time', leaderboardController.getAllTimeLeaderboard);

// GET /leaderboard/90-day
router.get('/90-day', leaderboardController.get90DayLeaderboard);

// GET /leaderboard/30-day
router.get('/30-day', leaderboardController.get30DayLeaderboard);

// GET /leaderboard/7-day
router.get('/7-day', leaderboardController.get7DayLeaderboard);

module.exports = router;
