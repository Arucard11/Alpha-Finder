const dotenv = require('dotenv');
dotenv.config();

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

async function addColumn() {
  const query = `
    ALTER TABLE runners
    ADD COLUMN IF NOT EXISTS totalsupply NUMERIC;
  `;
  
  try {
    await pool.query(query);
    console.log('Column totalsupply added successfully to runners table.');
  } catch (err) {
    console.error('Error adding column:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

addColumn(); 