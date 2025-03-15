const dotenv = require("dotenv")
dotenv.config()

const { Pool } = require('pg');

const pool = new Pool({
  host:process.env.PG_HOST,
  port:process.env.PG_PORT ,
  database:process.env.PG_DATABASE ,
  user:process.env.PG_USER ,
  password:process.env.PG_PASSWORD,
   
 });
const createTablesQuery = `
-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    runners JSONB NOT NULL,
    confidence_score NUMERIC,
    badges TEXT[] NOT NULL DEFAULT '{}'
);

-- Create runners table
CREATE TABLE IF NOT EXISTS runners (
    id SERIAL PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    logouri TEXT,
    symbol TEXT NOT NULL,
    timestamps JSONB NOT NULL,
    athprice NUMERIC NOT NULL,
    checked BOOLEAN NOT NULL DEFAULT FALSE 
);

-- Create filtered table
CREATE TABLE IF NOT EXISTS filtered (
    id SERIAL PRIMARY KEY,
    address TEXT NOT NULL UNIQUE
);

 -- Create whitelist table
 CREATE TABLE IF NOT EXISTS whitelist (
      id SERIAL PRIMARY KEY,
      name TEXT,
      wallet_address TEXT NOT NULL UNIQUE
  );
`;

async function setUpDb(){
  await pool.query(createTablesQuery)
    .then(() => {
      console.log('Tables created successfully.');
    }).finally(()=>{
      pool.end()
    })
    .catch(err => {
      console.error('Error creating tables:', err);
    })
    
}

module.exports = setUpDb;