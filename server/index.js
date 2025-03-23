require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const leaderboardRoutes = require('./routes/leaderboard.js');
const authRoutes = require("./routes/auth.js")
const coins = require("./controllers/coinsController.js")
const updateData = require("./helpers/updateData.js")
const admin = require('./routes/admin.js')
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
// You can add other endpoints for wallets and runners similarly...
app.use('/leaderboard', leaderboardRoutes);
app.use('/auth', authRoutes)
app.get('/getprices/:address',coins.getCoins)
app.use('/admin',admin)

const PORT = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, '../frontend/dist')));

// For any other requests, send back index.html so React Router can handle routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
})

cron.schedule('0 0 * * *', () => {
  updateData()
  }); 

app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});



