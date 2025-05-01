const { Pool } = require('pg');
const dotenv = require("dotenv")
dotenv.config()
/**
 * Migrates data from the 'whitelist' table of a source PostgreSQL database
 * to the 'whitelist' table of a destination PostgreSQL database.
 *
 * @param {object} sourcePoolConfig - Connection configuration object for the source database pool.
 *                                   Example: { user: 'source_user', host: 'source_host', database: 'source_db', password: 'source_password', port: 5432 }
 * @param {object} destPoolConfig - Connection configuration object for the destination database pool.
 *                                 Example: { user: 'dest_user', host: 'dest_host', database: 'dest_db', password: 'dest_password', port: 5432 }
 * @returns {Promise<void>} A promise that resolves when the migration is complete or rejects on error.
 */
async function migrateWhitelist(sourcePoolConfig, destPoolConfig) {
  let sourcePool;
  let destPool;
  let sourceClient;
  let destClient;

  try {
    // --- 1. Connect to Databases ---
    console.log('Connecting to source database...');
    sourcePool = new Pool(sourcePoolConfig);
    sourceClient = await sourcePool.connect();
    console.log('Connected to source database.');

    console.log('Connecting to destination database...');
    destPool = new Pool(destPoolConfig);
    destClient = await destPool.connect();
    console.log('Connected to destination database.');

    // --- 2. Fetch Data from Source ---
    console.log('Fetching data from source whitelist table...');
    const fetchQuery = 'SELECT name, wallet_address FROM whitelist;';
    const { rows: whitelistData } = await sourceClient.query(fetchQuery);
    console.log(`Fetched ${whitelistData.length} records from source.`);

    if (whitelistData.length === 0) {
      console.log('No data found in the source whitelist table. Migration skipped.');
      return;
    }

    // --- 3. Insert Data into Destination ---
    console.log('Inserting data into destination whitelist table...');
    // Use a transaction for atomicity
    await destClient.query('BEGIN');

    const insertQuery = `
      INSERT INTO whitelist (name, wallet_address)
      VALUES ($1, $2)
      ON CONFLICT (wallet_address) DO NOTHING;
    `;

    let insertedCount = 0;
    let skippedCount = 0;
    for (const record of whitelistData) {
      const result = await destClient.query(insertQuery, [record.name, record.wallet_address]);
      if (result.rowCount > 0) {
        insertedCount++;
      } else {
        skippedCount++; // Record likely already existed
      }
    }

    await destClient.query('COMMIT');
    console.log(`Insertion complete. Inserted: ${insertedCount}, Skipped (already existed): ${skippedCount}`);

    console.log('Whitelist migration successful!');

  } catch (error) {
    // Rollback transaction if error occurred during insertion
    if (destClient) {
      try {
        await destClient.query('ROLLBACK');
        console.error('Transaction rolled back due to error.');
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }
    console.error('Error during whitelist migration:', error);
    throw error; // Re-throw the error for higher-level handling

  } finally {
    // --- 4. Clean Up Connections ---
    if (sourceClient) {
      sourceClient.release();
      console.log('Released source client.');
    }
    if (sourcePool) {
      await sourcePool.end();
      console.log('Closed source pool.');
    }
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
const sourceDbConfig = {
    host:process.env.PG_HOST,
    port:process.env.PG_PORT ,
    database:process.env.PG_DATABASE ,
    user:process.env.PG_USER ,
    password:process.env.PG_PASSWORD,
};

const destinationDbConfig = {
  user: 'postgres.rdurefmcrxivvzfxxzkm',
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  database: 'postgres',
  password: 'nthgNRsQHMCOpunI',
  port: 5432, // Or your destination DB port
};

// 2. Call the migration function
migrateWhitelist(sourceDbConfig, destinationDbConfig)
  .then(() => {
    console.log('Migration script finished successfully.');
    process.exit(0); // Exit cleanly
  })
  .catch((err) => {
    console.error('Migration script failed:', err);
    process.exit(1); // Exit with error code
  });


module.exports = { migrateWhitelist }; 