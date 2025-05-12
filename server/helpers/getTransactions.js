'use strict';

const { connection } = require('./connection.js');
const { PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// Constants
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOL_MINT = 'So11111111111111111111111111111111111111112'; // Technically native mint
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // Changed from 90 to 30 days

// Helper function for retrying async operations
async function retryAsyncOperation(fn, maxAttempts = 3, delayMs = 1000, context = '') {
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    try {
      return await fn();
    } catch (error) {
      const isLastError = attempts === maxAttempts;
      const errorCode = error.code; // Specific code for SolanaJSONRPCError or system errors
      // Basic check for some common retriable errors (can be expanded)
      const isRetriableError = 
        (error.message && (error.message.includes('fetch failed') || error.message.includes('network error') || error.message.includes('ETIMEDOUT') || error.message.includes('ECONNRESET') || error.message.includes('terminated'))) ||
        (errorCode && (errorCode === -32019 || errorCode === 'ECONNRESET' || errorCode === 'ETIMEDOUT')) || // -32019: "Failed to query long-term storage"
        (error.response && typeof error.response.status === 'number' && error.response.status >= 500 && error.response.status < 600);


      if (!isLastError && isRetriableError) {
        const statusInfo = (error.response && error.response.status) ? ` (Status: ${error.response.status})` : '';
        const codeInfo = errorCode ? ` (Code: ${errorCode})` : '';
        console.warn(`[Retry] Attempt ${attempts} failed for ${context}${statusInfo}${codeInfo}. Retrying in ${delayMs}ms... Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Optional: exponential backoff
      } else {
        const statusInfo = (error.response && error.response.status) ? ` (Status: ${error.response.status})` : '';
        const codeInfo = errorCode ? ` (Code: ${errorCode})` : '';
        // Log as an error for final attempt or non-retriable error
        console.error(`[Retry] Final attempt ${attempts} failed for ${context}${statusInfo}${codeInfo} or error not retriable. Error: ${error.message}`);
        throw error; // Re-throw the error
      }
    }
  }
  // Should ideally not be reached if maxAttempts > 0
  throw new Error(`[Retry] Operation failed after ${maxAttempts} attempts for context: ${context}`);
}

/**
 * Fetches and analyzes transactions for a given wallet from the past 30 days
 * to find tokens bought by spending SOL.
 * @param {string} walletAddressString The public key of the wallet as a string.
 * @returns {Promise<string[]>} A promise that resolves to an array of unique mint addresses bought.
 */


async function getRecentBuys(walletAddressString) {
    const pLimit = (await import('p-limit')).default;

    console.log(`Analyzing transactions for wallet: ${walletAddressString}`);
    let walletPublicKey;
    try {
        walletPublicKey = new PublicKey(walletAddressString);
    } catch (error) {
        console.error("Invalid wallet address provided:", error);
        throw new Error("Invalid wallet address string.");
    }

    const boughtTokenMints = new Set();
    const cutoffTime = Date.now() - THIRTY_DAYS_MS; // Timestamp 30 days ago in ms
    const cutoffTimeSeconds = Math.floor(cutoffTime / 1000); // Convert to seconds for comparison with blockTime

    let signatures = [];
    let lastSignature = undefined;
    let fetchMore = true;
    const batchSize = 1000; // Max allowed by getSignaturesForAddress

    console.log(`Fetching transactions since ${new Date(cutoffTime).toISOString()} (last 30 days)...`);

    try {
        while (fetchMore) {
            const signatureInfos = await connection.getSignaturesForAddress(walletPublicKey, {
                limit: batchSize,
                before: lastSignature, // Paginate backwards in time
            });

            if (signatureInfos.length === 0) {
                fetchMore = false;
                break;
            }

            const oldestTxInBatch = signatureInfos[signatureInfos.length - 1];
            lastSignature = oldestTxInBatch.signature;

            // Filter signatures that are within the 30-day window
            const relevantSignatures = signatureInfos.filter(sigInfo => {
                // Check if blockTime exists and is more recent than the cutoff
                return sigInfo.blockTime && sigInfo.blockTime > cutoffTimeSeconds;
            });

            signatures.push(...relevantSignatures.map(s => s.signature));

            // If the oldest transaction fetched in this batch is older than our cutoff, stop fetching
            if (oldestTxInBatch.blockTime && oldestTxInBatch.blockTime <= cutoffTimeSeconds) {
                console.log(`Reached transactions older than 30 days (BlockTime: ${oldestTxInBatch.blockTime}, Cutoff: ${cutoffTimeSeconds}). Stopping signature fetch.`);
                fetchMore = false;
            }

            // Safety break if we fetch fewer than the batch size, indicating end of history (usually)
            if (signatureInfos.length < batchSize) {
                 console.log("Fetched last available batch of signatures.");
                fetchMore = false;
            }
            console.log(`Fetched ${signatureInfos.length} signatures, ${signatures.length} total relevant signatures so far... Last signature: ${lastSignature}`);
             // Add a small delay to avoid hitting rate limits aggressively
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`Found ${signatures.length} candidate transactions within the last 30 days.`);

        // Sequential processing starts here
        console.log(`Processing ${signatures.length} transactions concurrently with p-limit (limit 50)...`);
        const limit = pLimit(50);
        let processedCount = 0; // For approximate progress

        const transactionProcessingPromises = signatures.map((signature, txIndex) =>
          limit(async () => {
           
            
            try {
              // Use retryAsyncOperation for getTransaction
              const tx = await retryAsyncOperation(
                () => connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 }),
                3, // maxAttempts
                1000, // initialDelayMs
                `getTransaction for signature ${signature}` // context for logging
              );

              if (!tx || !tx.meta || tx.meta.err) {
                // Skip failed transactions or transactions where fetch failed post-retry or meta is missing
                console.warn(`[ProcessTx] Skipping signature ${signature} after retries: Transaction null, meta missing, or error in meta.`);
              } else {
                const { meta, transaction } = tx;
                let solSpent = false;
                let accountKeys = null;
                let walletIndex = -1;

                if (transaction && transaction.message && transaction.message.accountKeys) {
                  accountKeys = transaction.message.accountKeys.map(key => key.toBase58());
                  walletIndex = accountKeys.indexOf(walletAddressString);
                  if (walletIndex !== -1) {
                    const preSolBalance = meta.preBalances[walletIndex];
                    const postSolBalance = meta.postBalances[walletIndex];
                    solSpent = preSolBalance > postSolBalance;
                  }
                }

                const preTokenBalances = meta.preTokenBalances || [];
                const postTokenBalances = meta.postTokenBalances || [];

                for (const postBalance of postTokenBalances) {
                  let owner = postBalance.owner;
                  if (!owner && accountKeys && postBalance.accountIndex < accountKeys.length) {
                    owner = accountKeys[postBalance.accountIndex];
                  }
                  if (owner === walletAddressString) {
                    if (postBalance.mint !== SOL_MINT && postBalance.mint !== USDC_MINT) {
                      const preBalance = preTokenBalances.find(
                        (pre) => pre.accountIndex === postBalance.accountIndex && pre.mint === postBalance.mint
                      );
                      const preAmount = preBalance ? BigInt(preBalance.uiTokenAmount.amount) : 0n;
                      const postAmount = BigInt(postBalance.uiTokenAmount.amount);
                      if (postAmount > preAmount && solSpent) {
                        boughtTokenMints.add(postBalance.mint);
                        break; 
                      }
                    }
                  }
                }
              }
            } catch (err) {
              // This catch block will now mostly handle errors if retryAsyncOperation itself fails or re-throws a non-retriable error.
              console.error(`[ProcessTx] Critical error processing signature ${signature} after retries (or non-retriable error):`, err.message);
              // No specific rate limit check here as retryAsyncOperation handles logging for retriable issues.
            } finally {
                processedCount++;
                if (processedCount % 100 === 0 || processedCount === signatures.length) { // Log every 100 or at the end
                     console.log(`Processed approximately ${processedCount} / ${signatures.length} transactions...`);
                }
            }
          })
        );

        await Promise.all(transactionProcessingPromises);

        console.log(`Finished processing ${signatures.length} transactions.`);

    } catch (error) {
        console.error("Error fetching transaction signatures:", error);
        throw error; // Re-throw the error after logging
    }

    return Array.from(boughtTokenMints);
}

module.exports = { getRecentBuys };

// Example Usage (optional, for testing)


