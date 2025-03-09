require('dotenv').config();
const express = require('express');
const leaderboardRoutes = require('./routes/leaderboard.js');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// You can add other endpoints for wallets and runners similarly...
app.use('/leaderboard', leaderboardRoutes);

const PORT = process.env.PORT || 5000;


  
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});



