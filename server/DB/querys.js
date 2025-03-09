// dbFunctions.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString:`postgresql://postgres.yehtchekqvcjteijqojt:${process.env.PG_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
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
  const { address, runners, confidence_score, badges } = data;

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
    INSERT INTO wallets (address, runners, confidence_score, badges)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  try {
    const result = await pool.query(query, [
      sanitizedAddress,
      JSON.stringify(runners),
      confidence_score,
      sanitizedBadges,
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
  const allowedFields = ['address', 'runners', 'confidence_score', 'badges'];
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
    sanitizedValue = value.map(sanitizeString);
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
    const { address } = data;
    const sanitizedAddress = sanitizeString(address);
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
    const { address, name, timestamps, athprice,symbol,logoURI } = data;
    const sanitizedAddress = sanitizeString(address);
    const sanitizedName = sanitizeString(name);
    const timestamp = JSON.stringify(timestamps)
    
    const query = `
      INSERT INTO runners (address, name, timestamps, athprice, symbol, logouri)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    try {
      const result = await pool.query(query, [sanitizedAddress, sanitizedName,timestamp,athprice,symbol,logoURI]);
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

  module.exports = {
    addWallet,
    updateWallet,
    getWalletByAddress,
    addRunner,
    updateRunner,
    getAllWallets,
    getAllRunners,
    addFiltered,
    getAllFiltered,
    pool,
  };