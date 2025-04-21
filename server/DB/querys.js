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
      badges,
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
  if (typeof id !== 'number') {
    throw new Error('ID must be a number.');
  }

  // Allowed fields to update
  const allowedFields = ['address', 'runners', 'confidence_score', 'badges', 'pnl'];
  if (!allowedFields.includes(field)) {
    throw new Error(`Invalid field. Allowed fields are: ${allowedFields.join(', ')}`);
  }

  let sanitizedValue = value;
  if (field === 'address') {
    sanitizedValue = sanitizeString(value);
  } else if (field === 'runners') {
    if (!Array.isArray(value)) {
      throw new Error('runners must be an array of objects.');
    }
    sanitizedValue = JSON.stringify(value);
  } else if (field === 'confidence_score') {
    if (typeof value !== 'number') {
      throw new Error('confidence_score must be a number.');
    }
  } else if (field === 'badges') {
    if (!Array.isArray(value)) {
      throw new Error('badges must be an array of strings.');
    }
    sanitizedValue = value
  }

  const query = `UPDATE wallets SET ${field} = $1 WHERE id = $2 RETURNING *;`;
  try {
    const result = await pool.query(query, [sanitizedValue, id]);
    return result.rows[0];
  } catch (err) {
    console.error('Error updating wallet:', err);
    throw err;
  }
}


/**
 * Deletes a wallet from the database based on its ID.
 * @param {number | string} walletId - The unique ID of the wallet to delete.
 * @returns {Promise<number>} A promise that resolves with the number of rows deleted (0 or 1).
 * @throws {Error} Throws an error if the database query fails.
 */
async function deleteWalletById(walletId) {
  // *** IMPORTANT: Verify 'wallets' is the correct table name! ***
  const tableName = 'wallets';
  // *** IMPORTANT: Verify 'id' is the correct primary key column name! ***
  const idColumn = 'id';

  const queryText = `DELETE FROM ${tableName} WHERE ${idColumn} = $1;`;
  const params = [walletId]; // The value to substitute for $1

  console.log(`Attempting to delete wallet with ${idColumn}=${walletId} from table '${tableName}'...`);
  console.log(`Executing Query: ${queryText}`);
  console.log(`With Params: ${JSON.stringify(params)}`);


  try {
    // Execute the query using the connection pool
    const result = await pool.query(queryText, params);

    // result.rowCount contains the number of rows affected by the DELETE statement.
    console.log(`Delete successful. Rows affected: ${result.rowCount}`);

    // If the ID existed, rowCount will be 1. If not found, it will be 0.
    return result.rowCount;

  } catch (error) {
    console.error(`Error deleting wallet with ${idColumn}=${walletId} from table '${tableName}':`, error);
    // Re-throw the error so the calling function knows something went wrong
    throw new Error(`Failed to delete wallet (ID: ${walletId}): ${error.message}`);
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
 * @param {string} [sortBy='confidence'] - Sorting criteria: 'confidence', 'pnl', 'runners'.
 * @param {string[]} [badges=[]] - Array of badges to filter by.
 * @param {boolean} [excludeBots=false] - Whether to exclude wallets with the 'bot' badge.
 * @param {number} [athmcThreshold=null] - Minimum ATHMC threshold for runners (e.g., 2000000 for 2M, 5000000 for 5M).
 * @returns {Promise<Array>} - Array of wallet objects.
 */
async function getWalletsSorted(offset, sortBy = 'confidence', badges = [], excludeBots = false, athmcThreshold = null) {
  const limit = 50;
  let orderByClause;
  let whereClauses = [];
  let params = [limit, offset];
  let paramIndex = 3; // Start parameter index after limit and offset

  console.log(`Fetching wallets: sortBy=${sortBy}, offset=${offset}, limit=${limit}, badges=${badges.join(',') || 'none'}, excludeBots=${excludeBots}, athmcThreshold=${athmcThreshold}`);

  // Add badge filter if provided
  if (badges && badges.length > 0) {
    whereClauses.push(`badges @> $${paramIndex}::text[]`);
    params.push(badges);
    paramIndex++;
    console.log(`Adding badge filter: badges @> ${JSON.stringify(badges)}`);
  } else {
    console.log("No badge filter applied.");
  }

  // Add bot exclusion filter if requested
  if (excludeBots) {
    whereClauses.push(`NOT (badges @> ARRAY['bot']::text[])`);
    console.log("Excluding wallets with 'bot' badge.");
  }

  // Add ATHMC threshold filter if provided
  if (athmcThreshold !== null) {
    whereClauses.push(`EXISTS (
      SELECT 1
      FROM jsonb_array_elements(runners) AS runner
      WHERE (runner->>'athmc')::numeric >= $${paramIndex}
    )`);
    params.push(athmcThreshold);
    paramIndex++;
    console.log(`Adding ATHMC filter: runners with athmc >= ${athmcThreshold}`);
  }

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
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const query = `
    SELECT *
    FROM wallets
    ${whereClause} 
    ${orderByClause}
    LIMIT $1 OFFSET $2;
  `;

  try {
    const result = await pool.query(query, params);
    console.log(`Query successful, returned ${result.rows.length} rows.`);
    return result.rows;
  } catch (error) {
    console.error(`Error in getWalletsSorted (sortBy: ${sortBy}, badges: ${badges.join(',')}, excludeBots: ${excludeBots}, athmcThreshold: ${athmcThreshold}):`, error);
    console.error('Failed Query:', query);
    console.error('Failed Params:', params);
    throw error;
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
 * @param {string[]} [badges=[]] - Array of badges to filter by.
 * @param {boolean} [excludeBots=false] - Whether to exclude wallets with the 'bot' badge.
 * @param {number} [athmcThreshold=null] - Minimum ATHMC threshold for runners (e.g., 2000000 for 2M, 5000000 for 5M).
 * @returns {Promise<Array>} - Array of wallet objects.
 */
/**
 * Fetches wallets dynamically based on recent activity, with different sorting options.
 * Added PnL sorting: Tuesday, April 1, 2025 at 7:17:30 AM UTC
 */
async function getWalletsDynamic(days, offset, sortBy, badges = [], excludeBots = false, athmcThreshold = null) {
  // Calculate the timestamp threshold based on the number of days ago
  const unixTimeThreshold = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
  const limit = 50;
  let query; // Variable to hold the SQL query
  let params = [unixTimeThreshold, limit, offset]; // Initial parameters
  let paramIndex = 4; // Start parameter index after threshold, limit, and offset
  let badgeWhereClause = '';
  let botWhereClause = '';
  let athmcWhereClause = '';

  // Add badge filter if provided
  if (badges && badges.length > 0) {
    badgeWhereClause = `AND w.badges @> $${paramIndex}::text[]`;
    params.push(badges);
    paramIndex++;
    console.log(`Adding badge filter: w.badges @> ${JSON.stringify(badges)}`);
  } else {
    console.log("No badge filter applied.");
  }

  // Add bot exclusion filter if requested
  if (excludeBots) {
    botWhereClause = `AND NOT (w.badges @> ARRAY['bot']::text[])`;
    console.log("Excluding wallets with 'bot' badge.");
  }

  // Add ATHMC threshold filter if provided
  if (athmcThreshold !== null) {
    athmcWhereClause = `AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(w.runners) AS runner
      WHERE (runner->>'athmc')::numeric >= $${paramIndex}
    )`;
    params.push(athmcThreshold);
    paramIndex++;
    console.log(`Adding ATHMC filter: runners with athmc >= ${athmcThreshold}`);
  }

  // Log the parameters being used for debugging
  console.log(`getWalletsDynamic called with: days=${days}, offset=${offset}, sortBy=${sortBy}, badges=${badges.join(',') || 'none'}, excludeBots=${excludeBots}, athmcThreshold=${athmcThreshold}, threshold=${unixTimeThreshold}`);

  // --- Determine the SQL Query based on sortBy parameter ---

  if (sortBy === 'runners') {
    console.log("Constructing query to sort by runners count in timeframe...");
    query = `
      WITH wallet_runner_counts AS (
        SELECT 
          w.*,
          (
            SELECT jsonb_agg(runner)
            FROM jsonb_array_elements(w.runners) AS runner
            WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(runner->'transactions'->'buy') AS tx
              WHERE (tx->>'timestamp')::BIGINT >= $1
            )
          ) as filtered_runners,
          (
            SELECT COUNT(*)
            FROM jsonb_array_elements(w.runners) AS runner
            WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(runner->'transactions'->'buy') AS tx
              WHERE (tx->>'timestamp')::BIGINT >= $1
            )
          ) as runner_count,
          (
            SELECT COALESCE(SUM(
              CASE 
                WHEN jsonb_typeof(runner->'score') = 'number' 
                AND EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(runner->'transactions'->'buy') AS tx
                  WHERE (tx->>'timestamp')::BIGINT >= $1
                )
                THEN (runner->>'score')::numeric
                ELSE 0
              END
            ), 0)
            FROM jsonb_array_elements(w.runners) AS runner
          ) as calculated_score,
          (
            SELECT COALESCE(SUM(
              (
                SELECT COALESCE(SUM(CAST(sell->>'price' AS NUMERIC) * CAST(sell->>'amount' AS NUMERIC)), 0)
                FROM jsonb_array_elements(runner->'transactions'->'sell') sell
                WHERE CAST(sell->>'timestamp' AS BIGINT) >= $1
              ) - (
                SELECT COALESCE(SUM(CAST(buy->>'price' AS NUMERIC) * CAST(buy->>'amount' AS NUMERIC)), 0)
                FROM jsonb_array_elements(runner->'transactions'->'buy') buy
                WHERE CAST(buy->>'timestamp' AS BIGINT) >= $1
              )
            ), 0) as calculated_pnl
            FROM jsonb_array_elements(w.runners) AS runner
            WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(runner->'transactions'->'buy') AS tx
              WHERE (tx->>'timestamp')::BIGINT >= $1
            )
          )
        FROM wallets w
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(w.runners) AS runner,
               jsonb_array_elements(runner->'transactions'->'buy') AS tx
          WHERE (tx->>'timestamp')::BIGINT >= $1
        )
        ${badgeWhereClause}
        ${botWhereClause}
        ${athmcWhereClause}
      )
      SELECT 
        id,
        address,
        filtered_runners as runners,
        calculated_score as confidence_score,
        badges,
        calculated_pnl as pnl,
        runner_count
      FROM wallet_runner_counts
      ORDER BY runner_count DESC
      LIMIT $2 OFFSET $3;
    `;

  } else if (sortBy === 'pnl') {
    console.log("Constructing query to sort by PnL of runners in timeframe...");
    query = `
      WITH runner_pnls AS (
        SELECT 
          w.*,
          (
            SELECT jsonb_agg(runner)
            FROM jsonb_array_elements(w.runners) AS runner
            WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(runner->'transactions'->'buy') AS tx
              WHERE (tx->>'timestamp')::BIGINT >= $1
            )
          ) as filtered_runners,
          (
            SELECT COALESCE(SUM(
              CASE 
                WHEN jsonb_typeof(runner->'score') = 'number' 
                AND EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(runner->'transactions'->'buy') AS tx
                  WHERE (tx->>'timestamp')::BIGINT >= $1
                )
                THEN (runner->>'score')::numeric
                ELSE 0
              END
            ), 0)
            FROM jsonb_array_elements(w.runners) AS runner
          ) as calculated_score,
          (
            SELECT COALESCE(SUM(
              (
                SELECT COALESCE(SUM(CAST(sell->>'price' AS NUMERIC) * CAST(sell->>'amount' AS NUMERIC)), 0)
                FROM jsonb_array_elements(runner->'transactions'->'sell') sell
                WHERE CAST(sell->>'timestamp' AS BIGINT) >= $1
              ) - (
                SELECT COALESCE(SUM(CAST(buy->>'price' AS NUMERIC) * CAST(buy->>'amount' AS NUMERIC)), 0)
                FROM jsonb_array_elements(runner->'transactions'->'buy') buy
                WHERE CAST(buy->>'timestamp' AS BIGINT) >= $1
              )
            ), 0) as timeframe_pnl
            FROM jsonb_array_elements(w.runners) AS runner
            WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(runner->'transactions'->'buy') AS tx
              WHERE (tx->>'timestamp')::BIGINT >= $1
            )
          )
        FROM wallets w
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(w.runners) AS runner,
               jsonb_array_elements(runner->'transactions'->'buy') AS tx
          WHERE (tx->>'timestamp')::BIGINT >= $1
        )
        ${badgeWhereClause}
        ${botWhereClause}
        ${athmcWhereClause}
      )
      SELECT 
        id,
        address,
        filtered_runners as runners,
        calculated_score as confidence_score,
        badges,
        timeframe_pnl as pnl
      FROM runner_pnls
      ORDER BY timeframe_pnl DESC
      LIMIT $2 OFFSET $3;
    `;
  } else {
    console.log("Constructing query to sort by sum of qualifying runners' scores...");
    query = `
      WITH wallet_scores AS (
        SELECT 
          w.*,
          (
            SELECT jsonb_agg(runner)
            FROM jsonb_array_elements(w.runners) AS runner
            WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(runner->'transactions'->'buy') AS tx
              WHERE (tx->>'timestamp')::BIGINT >= $1
            )
          ) as filtered_runners,
          (
            SELECT COALESCE(SUM(
              CASE 
                WHEN jsonb_typeof(runner->'score') = 'number' 
                AND EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(runner->'transactions'->'buy') AS tx
                  WHERE (tx->>'timestamp')::BIGINT >= $1
                )
                THEN (runner->>'score')::numeric
                ELSE 0
              END
            ), 0)
            FROM jsonb_array_elements(w.runners) AS runner
          ) as calculated_score
        FROM wallets w
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(w.runners) AS runner,
               jsonb_array_elements(runner->'transactions'->'buy') AS tx
          WHERE (tx->>'timestamp')::BIGINT >= $1
        )
        ${badgeWhereClause}
        ${botWhereClause}
        ${athmcWhereClause}
      )
      SELECT 
        id,
        address,
        filtered_runners as runners,
        calculated_score as confidence_score,
        badges,
        pnl
      FROM wallet_scores
      ORDER BY calculated_score DESC
      LIMIT $2 OFFSET $3;
    `;
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

async function getWalletsContainingRunner(runnerAddress, offset = 0, limit = 50) {
  const query = `
    SELECT *
    FROM wallets
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(runners) AS runner
      WHERE runner->>'address' = $1
    )
    ORDER BY confidence_score DESC
    LIMIT $2 OFFSET $3;
  `;

  try {
    const result = await pool.query(query, [runnerAddress, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching wallets containing runner:', error);
    throw error;
  }
}

async function getBasicRunnerInfo() {
  const query = `
    SELECT address, logouri, name, symbol, created as created_at
    FROM runners
    WHERE athmc > 1200000
    AND created >= NOW() - INTERVAL '30 days'
    ORDER BY created DESC
    LIMIT 10;
  `;
  try {
    const result = await pool.query(query);
    return result.rows;
  } catch (err) {
    console.error('Error fetching runner basic info:', err);
    throw err;
  }
}

async function getRunnerLaunchStats() {
  const query = `
    WITH time_blocks AS (
      SELECT 
        date_trunc('hour', created) as block_start,
        count(*) as launches,
        EXTRACT(DOW FROM created) as day_of_week,
        EXTRACT(DAY FROM created) as day_of_month,
        EXTRACT(HOUR FROM created) as hour_of_day
      FROM runners
      GROUP BY 
        date_trunc('hour', created),
        EXTRACT(DOW FROM created),
        EXTRACT(DAY FROM created),
        EXTRACT(HOUR FROM created)
    ),
    day_stats AS (
      SELECT 
        day_of_week,
        SUM(launches) as total_launches
      FROM time_blocks
      GROUP BY day_of_week
      ORDER BY total_launches DESC
      LIMIT 3
    ),
    hour_stats AS (
      SELECT 
        hour_of_day,
        SUM(launches) as total_launches
      FROM time_blocks
      GROUP BY hour_of_day
      ORDER BY total_launches DESC
      LIMIT 3
    ),
    month_distribution AS (
      SELECT 
        CASE 
          WHEN day_of_month <= 15 THEN 'early'
          ELSE 'late'
        END as month_part,
        COUNT(*) as count
      FROM time_blocks
      GROUP BY 
        CASE 
          WHEN day_of_month <= 15 THEN 'early'
          ELSE 'late'
        END
    )
    SELECT 
      json_build_object(
        'peak_hours', (
          SELECT json_agg(
            json_build_object(
              'hour', hour_of_day,
              'count', total_launches
            )
          )
          FROM hour_stats
        ),
        'top_days', (
          SELECT json_agg(
            json_build_object(
              'day', day_of_week,
              'count', total_launches
            )
          )
          FROM day_stats
        ),
        'month_distribution', (
          SELECT json_object_agg(
            month_part, count
          )
          FROM month_distribution
        )
      ) as stats;
  `;
  
  try {
    const result = await pool.query(query);
    return result.rows[0].stats;
  } catch (err) {
    console.error('Error calculating runner launch stats:', err);
    throw err;
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
  deleteWalletById,
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
  getWalletsContainingRunner,
  getBasicRunnerInfo,
  getRunnerLaunchStats,
  pool,
};