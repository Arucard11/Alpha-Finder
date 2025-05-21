const dotenv = require("dotenv")
dotenv.config()
const { Connection } = require('@solana/web3.js');
exports.connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`)