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
const setUpDb = require("./DB/createTables.js")
//https://spectra-78nr.onrender.com,

// Define allowed origins for CORS
const allowedOrigins = [
  'https://alpha-finder.onrender.com',
  'http://localhost:5173',
  'https://spectra-78nr.onrender.com'
];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply more specific CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl) 
    // or if origin is in the allowedOrigins list
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // It's good practice to log or handle disallowed origins if needed
      // console.error(`CORS Error: Origin ${origin} not allowed.`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true, // Allows cookies and authorization headers
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', // Specify allowed methods
  allowedHeaders: 'Content-Type,Authorization,X-Requested-With' // Specify allowed headers
}));
// You can add other endpoints for wallets and runners similarly...
app.use('/leaderboard', leaderboardRoutes);
app.use('/auth', authRoutes)
app.get('/getprices/:address',coins.getCoins)
app.use('/admin',admin)
// 404 JSON handler for API routes (must come after all API routes, before catch-all)
app.use(['/leaderboard', '/auth', '/admin', '/getprices'], (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

const PORT = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Catch-all: Only serve index.html for non-API routes
app.get(/^\/(?!leaderboard|auth|admin|getprices).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
 setUpDb().then(()=>{
  updateData()
 }).catch((err)=>{
  console.log(err)
 })
cron.schedule('0 */24 * * *', () => {
  updateData()
}); 

app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});



