require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const leaderboardRoutes = require('./routes/leaderboard.js');
const authRoutes = require("./routes/auth.js")
const coins = require("./controllers/coinsController.js")
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
// You can add other endpoints for wallets and runners similarly...
app.use('/leaderboard', leaderboardRoutes);
app.use('/auth', authRoutes)
app.get('/coins',coins.getCoins)

const PORT = process.env.PORT || 5000;


  

app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});



