const { connection } = require('../connection.js');
const { PublicKey } = require('@solana/web3.js');
const borsh = require('@project-serum/borsh');
const bs58 = require('bs58');

const PROGRAM_ID = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

const poolSchema = borsh.struct([
    borsh.u8('poolBump'),
    borsh.u16('index'),
    borsh.publicKey('creator'),
    borsh.publicKey('baseMint'),
    borsh.publicKey('quoteMint'),
    borsh.publicKey('lpMint'),
    borsh.publicKey('poolBaseTokenAccount'),
    borsh.publicKey('poolQuoteTokenAccount'),
    borsh.u64('lpSupply'),
]);

// Pool account discriminator
const POOL_DISCRIMINATOR = Buffer.from([241, 154, 109, 4, 17, 177, 109, 188]);

async function getPumpSwapMints() {
    const mintAddresses = new Set();
    
    try {
        const discriminator = bs58.default.encode(POOL_DISCRIMINATOR);
        const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
            filters: [{
                memcmp: {
                    offset: 0,
                    bytes: discriminator
                }
            }],
            commitment: 'confirmed',
            encoding: 'base64'
        });

        // Process accounts and collect mints
        for (const { account } of accounts) {
            try {
                const data = account.data.slice(8);
                const poolData = poolSchema.decode(data);
                
                [poolData.baseMint, poolData.quoteMint]
                    .map(mint => mint.toBase58())
                    .filter(mint => 
                        mint !== WSOL_MINT &&
                        mint.slice(-4) === 'pump'
                    )
                    .forEach(mint => mintAddresses.add(mint));
            } catch (error) {
                console.error('Decoding error:', error);
            }
        }

        // Convert to array and fetch asset info
        const filteredMints = Array.from(mintAddresses);
      return filteredMints
    } catch (error) {
        console.error('Global error:', error);
        return [];
    }
}

module.exports = getPumpSwapMints;