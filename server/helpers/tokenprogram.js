const {connection} = require("./connection.js")
const {PublicKey} = require("@solana/web3.js")

const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

async function getRecentSPLMints() {
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000); // Convert to seconds
  let beforeSignature = undefined;
  const recentMints = new Set();

  while (true) {
      const signatures = await connection.getSignaturesForAddress(SPL_TOKEN_PROGRAM_ID, {
          before: beforeSignature,
          limit: 1000
      });

      if (signatures.length === 0) break;

      for (const { signature, blockTime } of signatures) {
          if (blockTime === null || blockTime < thirtyDaysAgo) {
              // Stop if beyond the 30-day window
              return Array.from(recentMints);
          }

          const tx = await connection.getTransaction(signature, {
              maxSupportedTransactionVersion: 0
          });

          if (!tx || tx.meta?.err || !tx.transaction.message.instructions) continue;

          for (const ix of tx.transaction.message.instructions) {
              const programId = tx.transaction.message.accountKeys[ix.programIdIndex];
              if (!programId.equals(SPL_TOKEN_PROGRAM_ID)) continue;

              const data = Buffer.from(ix.data, 'base64');
              if (data[0] !== 0) continue; // Check for initializeMint (discriminator 0)

              const mintAccountIndex = ix.accounts[0];
              const mintAccount = tx.transaction.message.accountKeys[mintAccountIndex];
              recentMints.add(mintAccount.toBase58());
          }
      }

      beforeSignature = signatures[signatures.length - 1].signature;
  }

  return Array.from(recentMints);
}

// Example usage
getRecentSPLMints()
  .then(mints => console.log('Recent SPL Tokens:', mints))
  .catch(console.error);