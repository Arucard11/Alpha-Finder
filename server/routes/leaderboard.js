// routes/leaderboard.js
const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');

// GET /leaderboard/all-time
router.post('/all-time', leaderboardController.getAllTimeLeaderboard);

// GET /leaderboard/90-day
router.post('/day', leaderboardController.getDayLeaderboard);


module.exports = router;
