// dbFunctions.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
 host:process.env.PG_HOST,
 port:process.env.PG_PORT ,
 database:process.env.PG_DATABASE ,
 user:process.env.PG_USER ,
 password:process.env.PG_PASSWORD,
 statement_timeout: 600000,
});

// Helper function to validate and sanitize strings.
function sanitizeString(input) {
  if (typeof input !== 'string') {
    throw new Error('Expected a string');
  }
  return input.trim();
}

/**
 * Add a new wallet record.
 * @param {Object} data - The wallet data.
 * @param {string} data.address - The wallet address.
 * @param {Object[]} data.runners - Array of objects (stored as JSONB).
 * @param {number} data.confidence_score - The confidence score.
 * @param {string[]} data.badges - Array of badge strings.
 * @returns {Promise<Object>} The inserted wallet record.
 */
async function addWallet(data) {
  const { address, runners, confidence_score, badges, pnl } = data;

  const sanitizedAddress = sanitizeString(address);
  if (!Array.isArray(runners)) {
    throw new Error('runners must be an array of objects.');
  }
  if (typeof confidence_score !== 'number') {
    throw new Error('confidence_score must be a number.');
  }
  if (!Array.isArray(badges)) {
    throw new Error('badges must be an array of strings.');
  }
  const sanitizedBadges = badges.map(sanitizeString);

  const query = `
    INSERT INTO wallets (address, runners, confidence_score, badges, pnl)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  try {
    const result = await pool.query(query, [
      sanitizedAddress,
      JSON.stringify(runners),
      confidence_score,
      sanitizedBadges,
      pnl
    ]);
    return result.rows[0];
  } catch (err) {
    console.error('Error inserting wallet:', err);
    throw err;
  }
}

/**
 * Update a single field in an existing wallet record.
 * @param {number} id - The ID of the wallet to update.
 * @param {string} field - The field to update (allowed: 'address', 'runners', 'confidence_score', 'badges').
 * @param {any} value - The new value for the field.
 * @returns {Promise<Object>} The updated wallet record.
 */
async function updateWallet(id, field, value) {
  

  const query = `UPDATE wallets SET ${field} = $1 WHERE id = $2 RETURNING *;`;
  try {
    const result = await pool.query(query, [value, id]);
    return result.rows[0];
  } catch (err) {
    console.error('Error updating wallet:', err);
    throw err;
  }
}

/**
 * Fetch a wallet by its address.
 * @param {string} address - The wallet address.
 * @returns {Promise<Object>} The wallet record, if found.
 */
async function getWalletByAddress(address) {
  const sanitizedAddress = sanitizeString(address);
  const query = `SELECT * FROM wallets WHERE address = $1;`;
  try {
    const result = await pool.query(query, [sanitizedAddress]);
    return result.rows[0];
  } catch (err) {
    console.error('Error fetching wallet by address:', err);
    throw err;
  }
}
async function getRunnerByAddress(address) {
  const sanitizedAddress = sanitizeString(address);
  const query = `SELECT * FROM runners WHERE address = $1;`;
  try {
    const result = await pool.query(query, [sanitizedAddress]);
    return result.rows[0];
  } catch (err) {
    console.error('Error fetching wallet by address:', err);
    throw err;
  }
}



async function getTotalRunners() {
  // *** IMPORTANT: Change 'runners' to your actual table name if different! ***
  const tableName = 'runners';
  const queryText = `SELECT COUNT(*) FROM ${tableName};`;

  try {
    const result = await pool.query(queryText);
    // COUNT(*) returns a bigint, often as a string by pg. Convert to number.
    const count = parseInt(result.rows[0].count, 10);
    return count;
  } catch (error) {
    console.error(`Error fetching runner count from table '${tableName}':`, error);
    // Re-throw the error so the caller knows the operation failed
    throw new Error(`Failed to get total runners: ${error.message}`);
  }
}

/**
 * Retrieves wallets ordered by highest confidence_score.
 * Returns 50 records per call based on the provided offset.
 *
 * @param {number} [offset] - Number of records to skip for pagination.
 * @returns {Promise<Array>} - Array of wallet objects.
 */
async function getWalletsSorted(offset, sortBy = 'confidence') { // Default sortBy to 'confidence'
  const limit = 50;
  let orderByClause;

  console.log(`Fetching wallets: sortBy=${sortBy}, offset=${offset}, limit=${limit}`);

  // Determine the ORDER BY clause based on the sortBy parameter
  switch (sortBy) {
    case 'pnl':
      // Sort by Profit and Loss (descending), NULLs last, tie-break with ID
      orderByClause = 'ORDER BY pnl DESC NULLS LAST, id ASC';
      console.log("Sorting by PnL");
      break;
    case 'runners':
      // Sort by the number of elements in the 'runners' JSONB array (descending), tie-break with ID
      // Assumes 'runners' is a JSONB array column
      orderByClause = 'ORDER BY jsonb_array_length(runners) DESC NULLS LAST, id ASC';
       console.log("Sorting by Runner Count");
      break;
    case 'confidence':
    default:
      // Default sort by confidence_score (descending), tie-break with ID
      orderByClause = 'ORDER BY confidence_score DESC, id ASC';
      console.log("Sorting by Confidence Score (default)");
      break;
  }

  // Construct the final query
  const query = `
    SELECT *
    FROM wallets
    ${orderByClause}
    LIMIT $1 OFFSET $2;
  `;

  try {
    const result = await pool.query(query, [limit, offset]);
    console.log(`Query successful, returned ${result.rows.length} rows.`);
    return result.rows; // Return the rows directly fetched from DB
  } catch (error) {
    console.error(`Error in getWalletsSorted (sortBy: ${sortBy}):`, error);
    console.error('Failed Query:', query); // Log the specific query that failed
    console.error('Failed Params:', [limit, offset]);
    throw error; // Re-throw the error for the caller to handle
  }
}


/**
 * Retrieves wallets that have at least one runner with a buy transaction within the last `days` days.
 * The results can be sorted by either highest confidence score or by the number of matching runners.
 * Returns 50 records at a time using an offset.
 *
 * @param {number} [days] - Number of days to look back.
 * @param {number} [offset] - Number of records to skip for pagination.
 * @param {string} [sortBy] - Sorting criteria: 'confidence' or 'runners'.
 * @returns {Promise<Array>} - Array of wallet objects.
 */
/**
 * Fetches wallets dynamically based on recent activity, with different sorting options.
 * Added PnL sorting: Tuesday, April 1, 2025 at 7:17:30 AM UTC
 */
async function getWalletsDynamic(days, offset, sortBy) {
  // Calculate the timestamp threshold based on the number of days ago
  const unixTimeThreshold = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60); // More explicit calculation
  const limit = 50; // Define the pagination limit
  let query; // Variable to hold the SQL query
  let params = [unixTimeThreshold, limit, offset]; // Parameters for the SQL query

  // Log the parameters being used for debugging
  console.log(`getWalletsDynamic called with: days=${days}, offset=${offset}, sortBy=${sortBy}, threshold=${unixTimeThreshold}`);

  // --- Determine the SQL Query based on sortBy parameter ---

  if (sortBy === 'runners') {
    // Sort by the count of runners having recent buy activity
    console.log("Constructing query to sort by runners count...");
    query = `
      SELECT
        w.*,
        -- Subquery to count runners with at least one buy transaction after the threshold
        (
          SELECT COUNT(*)
          FROM jsonb_array_elements(w.runners) AS runner
          WHERE EXISTS (
            SELECT 1
            FROM jsonb_array_elements(runner->'transactions'->'buy') AS buyTx
            WHERE (buyTx->>'timestamp')::BIGINT >= $1 -- $1 = unixTimeThreshold
          )
        ) AS matching_runners_count -- Alias for the calculated count
      FROM wallets w
      -- Filter wallets to include only those with at least one recent buy transaction overall
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(w.runners) AS runner,
             jsonb_array_elements(runner->'transactions'->'buy') AS buyTx
        WHERE (buyTx->>'timestamp')::BIGINT >= $1 -- $1 = unixTimeThreshold
      )
      -- Order by the calculated runner count (desc), then confidence score (desc), then ID (asc) for tie-breaking
      ORDER BY matching_runners_count DESC, confidence_score DESC, id ASC
      LIMIT $2 OFFSET $3; -- $2 = limit, $3 = offset
    `;
    // Note: The params array [unixTimeThreshold, limit, offset] matches the $1, $2, $3 placeholders.

  } else if (sortBy === 'pnl') {
    // Sort by the pre-calculated PnL field
    console.log("Constructing query to sort by PnL...");
    query = `
      SELECT * -- Select all columns from the wallets table
      FROM wallets w
      -- Filter wallets to include only those with at least one recent buy transaction
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(w.runners) AS runner,
             jsonb_array_elements(runner->'transactions'->'buy') AS buyTx
        WHERE (buyTx->>'timestamp')::BIGINT >= $1 -- $1 = unixTimeThreshold
      )
      -- Order by PnL (desc), then confidence score (desc), then ID (asc) for tie-breaking
      -- Use NULLS LAST in case the pnl field hasn't been populated for some wallets yet
      ORDER BY pnl DESC NULLS LAST, confidence_score DESC, id ASC
      LIMIT $2 OFFSET $3; -- $2 = limit, $3 = offset
    `;
    // Note: The params array [unixTimeThreshold, limit, offset] matches the $1, $2, $3 placeholders.

  } else {
    // Default sort: primarily by confidence_score
    console.log("Constructing query to sort by default (confidence_score)...");
    query = `
      SELECT * -- Select all columns from the wallets table
      FROM wallets w
      -- Filter wallets to include only those with at least one recent buy transaction
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(w.runners) AS runner,
             jsonb_array_elements(runner->'transactions'->'buy') AS buyTx
        WHERE (buyTx->>'timestamp')::BIGINT >= $1 -- $1 = unixTimeThreshold
      )
      -- Order by confidence score (desc), then ID (asc) for tie-breaking
      ORDER BY confidence_score DESC, id ASC
      LIMIT $2 OFFSET $3; -- $2 = limit, $3 = offset
    `;
    // Note: The params array [unixTimeThreshold, limit, offset] matches the $1, $2, $3 placeholders.
  }

  // Log the final query before execution
  console.log('Executing Query:', query);
  console.log('With Params:', params);

  try {
    // Execute the determined query using the connection pool
    const result = await pool.query(query, params);
    // Return the fetched rows
    console.log(`Query successful, returning ${result.rows.length} rows.`);
    return result.rows;
  } catch (error) {
    // Log any errors during query execution and re-throw
    console.error('Error executing query in getWalletsDynamic:', error);
    console.error('Failed Query:', query); // Log the query that failed
    console.error('Failed Params:', params); // Log the params used
    throw error; // Propagate the error up
  }
}


/**
 * Fetch all wallet records.
 * @returns {Promise<Array>} Array of wallet records.
 */
async function getAllWallets() {
  try {
    const result = await pool.query('SELECT * FROM wallets;');
    return result.rows;
  } catch (err) {
    console.error('Error fetching wallets:', err);
    throw err;
  }
}


async function addFiltered(data) {
    
    const sanitizedAddress = sanitizeString(data);
    const query = `
      INSERT INTO filtered (address)
      VALUES ($1)
      RETURNING *;
    `;
    try {
      const result = await pool.query(query, [sanitizedAddress]);
      return result.rows[0];
    } catch (err) {
      console.error('Error inserting filtered record:', err);
      throw err;
    }
  }

/**
 * Fetch all filtered records.
 * @returns {Promise<Array>} Array of filtered records.
 */
async function getAllFiltered() {
    try {
      const result = await pool.query('SELECT * FROM filtered;');
      return result.rows;
    } catch (err) {
      console.error('Error fetching filtered records:', err);
      throw err;
    }
  }


/**
 * Add a new runner record.
 * @param {Object} data - The runner data.
 * @param {string} data.address - The runner address.
 * @param {number} data.athmc - The numerical value for athmc.
 * @param {string} data.name - The runner's name.
 * @returns {Promise<Object>} The inserted runner record.
 */
async function addRunner(data) { 
    const { address, name, timestamps, athprice,symbol,logo_uri,athmc, created_at} = data;
    const sanitizedAddress = sanitizeString(address);
    const sanitizedName = sanitizeString(name);
    const timestamp = JSON.stringify(timestamps)
    
    const query = `
      INSERT INTO runners (address, name, timestamps, athprice, symbol,logouri, athmc, created)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    try {
      const result = await pool.query(query, [sanitizedAddress, sanitizedName,timestamp,athprice,symbol,logo_uri,athmc, created_at]);
      return result.rows[0];
    } catch (err) {
      console.error('Error inserting runner:', err);
      throw err;
    }
  }

/**
 * Fetch all runner records.
 * @returns {Promise<Array>} Array of runner records.
 */
async function getAllRunners() {
  try {
    const result = await pool.query('SELECT * FROM runners;');
    return result.rows;
  } catch (err) {
    console.error('Error fetching runners:', err);
    throw err;
  }
}

/**
 * Update a single field in an existing runner record.
 * @param {number} id - The ID of the runner to update.
 * @param {string} field - The field to update (allowed: 'address', 'athmc', 'name').
 * @param {any} value - The new value for the field.
 * @returns {Promise<Object>} The updated runner record.
 */


async function updateRunner(id, field, value) {
    if (typeof id !== 'number') {
      throw new Error('ID must be a number.');
    }
  
    // Allowed fields to update
    const allowedFields = ['address', 'athmc', 'name',"checked"];
    if (!allowedFields.includes(field)) {
      throw new Error(`Invalid field. Allowed fields are: ${allowedFields.join(', ')}`);
    }
  
    let sanitizedValue = value;
    if (field === 'address' || field === 'name' || field === "checked" ) {
      sanitizedValue = value
    } else if (field === 'athmc') {
      if (typeof value !== 'number') {
        throw new Error('athmc must be a number.');
      }
    }
  
    const query = `UPDATE runners SET ${field} = $1 WHERE id = $2 RETURNING *;`;
    try {
      const result = await pool.query(query, [sanitizedValue, id]);
      return result.rows[0];
    } catch (err) {
      console.error('Error updating runner:', err);
      throw err;
    }
  }

  /**
 * Queries the database to get all runners where the 'checked' property is false.
 * @param {string} [tableName='runners'] - The name of the table containing runner data.
 * @param {string} [checkedColumn='is_checked'] - The exact name of the boolean column indicating if a runner is checked.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of runner objects that are not checked.
 * @throws {Error} Throws an error if the database query fails.
 */
async function getUncheckedRunners(tableName = 'runners', checkedColumn = 'checked') {
  // *** IMPORTANT: Verify 'runners' and 'is_checked' are correct for your DB! ***

  // Basic sanitization for the column name to prevent SQL injection vulnerabilities
  // Allows only alphanumeric characters and underscores
  const safeCheckedColumn = checkedColumn.replace(/[^a-zA-Z0-9_]/g, '');
  if (safeCheckedColumn !== checkedColumn) {
      // If sanitization removed characters, it might be an invalid/malicious name
      console.error(`Invalid characters found in checked column name: ${checkedColumn}`);
      throw new Error(`Invalid checked column name specified: ${checkedColumn}`);
  }

  // Construct the query using the sanitized column name.
  // Assumes the column type is BOOLEAN. The value 'false' is a standard SQL boolean literal.
  const queryText = `SELECT * FROM ${tableName} WHERE ${safeCheckedColumn} = false;`;

  console.log(`Executing query to find unchecked runners: ${queryText}`); // Logging for debugging

  try {
      // Execute the query. No parameters ($1, $2...) are needed for this specific query
      // because 'false' is a literal value, not user input requiring parameterization.
      const result = await pool.query(queryText);

      console.log(`Found ${result.rows.length} unchecked runners.`); // Log the count found
      return result.rows; // Return the array of full runner objects

  } catch (error) {
      console.error(`Error fetching unchecked runners from table '${tableName}' where '${safeCheckedColumn}' is false:`, error);
      // Re-throw the error so the calling function is aware of the failure
      throw new Error(`Failed to get unchecked runners: ${error.message}`);
  }
}

  async function getAllRunnerAddresses(tableName = 'runners', addressColumn = 'address') {
    // *** IMPORTANT: Verify 'runners' and 'address' are correct for your DB! ***
    // Ensure the addressColumn name is safe if it were dynamic (though unlikely here)
    // Basic sanitization: remove anything not alphanumeric or underscore
    const safeAddressColumn = addressColumn.replace(/[^a-zA-Z0-9_]/g, '');
    if (safeAddressColumn !== addressColumn) {
        throw new Error(`Invalid address column name specified: ${addressColumn}`);
    }
  
    // Use the sanitized column name in the query
    const queryText = `SELECT ${safeAddressColumn} FROM ${tableName};`;
    console.log(`Executing query: ${queryText}`); // Optional: logging
  
    try {
      const result = await pool.query(queryText);
  
      // result.rows will be an array of objects, e.g., [{ address: '123 Main St' }, { address: '456 Oak Ave' }]
      // We need to extract just the address string from each object.
      const addresses = result.rows.map(row => row[safeAddressColumn]); // Use bracket notation for dynamic column name
  
      console.log(`Found ${addresses.length} addresses.`); // Optional: logging
      return addresses; // Returns an array of strings: ['123 Main St', '456 Oak Ave']
  
    } catch (error) {
      console.error(`Error fetching runner addresses from table '${tableName}', column '${safeAddressColumn}':`, error);
      // Re-throw the error so the caller knows the operation failed
      throw new Error(`Failed to get runner addresses: ${error.message}`);
    }
  }

async function getWhitelist(){
  try {
    const result = await pool.query('SELECT * FROM whitelist;');
    return result.rows;
  } catch (err) {
    console.error('Error fetching runners:', err);
    throw err;
  }
}


async function addWhitelist(data) {
  let { address, name } = data;
  // Set a default name if none provided
  name = name || 'Unknown'; // or you can use an empty string: name = name || '';

  const sanitizedAddress = sanitizeString(address);
  const sanitizedName = sanitizeString(name); // Optional: sanitize the name as well

  const query = `
    INSERT INTO whitelist (wallet_address, name)
    VALUES ($1, $2)
    RETURNING *;
  `;

  try {
    const result = await pool.query(query, [sanitizedAddress, sanitizedName]);
    return result.rows[0];
  } catch (err) {
    console.error('Error inserting record into whitelist:', err);
    throw err;
  }
}


/**
 * Deletes a record from the whitelist table based on the given wallet address.
 *
 * @param {string} walletAddress - The wallet address to delete.
 * @returns {Promise<number>} - The number of rows deleted.
 */
async function deleteWhitelist(walletAddress) {
  const query = `
    DELETE FROM whitelist
    WHERE wallet_address = $1;
  `;

  try {
    const result = await pool.query(query, [walletAddress]);
    console.log(`Deleted ${result.rowCount} record(s) for wallet address: ${walletAddress}`);
    return result.rowCount;
  } catch (error) {
    console.error('Error deleting from whitelist:', error);
    throw error;
  }
}


  module.exports = {
    addWallet,
    getWhitelist,
    addWhitelist,
    deleteWhitelist,
    updateWallet,
    getWalletByAddress,
    addRunner,
    getUncheckedRunners,
    getTotalRunners,
    updateRunner,
    getAllRunnerAddresses,
    getAllWallets,
    getWalletsSorted,
    getAllRunners,
    addFiltered,
    getWalletsDynamic,
    getRunnerByAddress,
    getAllFiltered,
    pool,
  };