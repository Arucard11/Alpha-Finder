const { Pool } = require('pg');
const dotenv = require("dotenv")
dotenv.config()

/**
 * Drops the 'runners' and 'wallets' tables from both source and destination databases if they exist.
 *
 * @param {object} sourcePoolConfig - Connection configuration object for the source database pool.
 * @param {object} destPoolConfig - Connection configuration object for the destination database pool.
 * @returns {Promise<void>} A promise that resolves when the tables are dropped or rejects on error.
 */
async function dropRunnerAndWalletTables( destPoolConfig) {
 
  let destPool;
 
  let destClient;

  try {
   


    console.log('Connecting to destination database for table drop...');
    destPool = new Pool(destPoolConfig);
    destClient = await destPool.connect();
    console.log('Connected to destination database.');

   

    console.log('Dropping tables from destination database...');
    
    await destClient.query('DROP TABLE IF EXISTS wallets;');
    console.log('Dropped runners and wallets tables from destination (if they existed).');

    console.log('Table dropping process completed successfully!');

  } catch (error) {
    console.error('Error during table dropping:', error);
    throw error; // Re-throw the error for higher-level handling

  } finally {
    // --- 3. Clean Up Connections ---
  
 
    
    if (destClient) {
      destClient.release();
      console.log('Released destination client.');
    }
    if (destPool) {
      await destPool.end();
      console.log('Closed destination pool.');
    }
  }
}

// --- How to Use ---

// 1. Define your database connection configurations

const destinationDbConfig = {
  user: 'postgres.rdurefmcrxivvzfxxzkm',
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  database: 'postgres',
  password: 'nthgNRsQHMCOpunI',
  port: 5432, // Or your destination DB port
};


dropRunnerAndWalletTables(destinationDbConfig)
module.exports = {  dropRunnerAndWalletTables }; 