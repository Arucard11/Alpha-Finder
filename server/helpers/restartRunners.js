const {getAllRunners,updateRunner,getAllWallets, deleteWalletById, updateWallet} = require('../DB/querys')


const sandwichConfig = {
    minTotalTransactions: 4,
    timeThresholdSeconds: 60,
    amountThresholdPercent: 0.30,
    minSandwichPairs: 1
};

/**
 * Helper function to detect potential sandwich bot behavior for a specific runner.
 */
function isPotentialSandwichBot(runner, config) {
    const buys = runner.transactions?.buy || [];
    const sells = runner.transactions?.sell || [];
    const totalTransactions = buys.length + sells.length;

    if (totalTransactions < config.minTotalTransactions) return false;

    const allTxns = [
        ...buys.map(tx => ({ ...tx, type: 'buy', usd_value: (tx.amount || 0) * (tx.price || 0), timestamp: tx.timestamp })),
        ...sells.map(tx => ({ ...tx, type: 'sell', usd_value: (tx.amount || 0) * (tx.price || 0), timestamp: tx.timestamp }))
    ];

    const validTxns = allTxns.filter(tx => typeof tx.timestamp === 'number' && !isNaN(tx.timestamp));
    validTxns.sort((a, b) => a.timestamp - b.timestamp);

    let sandwichPairCount = 0;
    for (let i = 0; i < validTxns.length - 1; i++) {
        const currentTx = validTxns[i];
        const nextTx = validTxns[i + 1];

        if (currentTx.type === nextTx.type) continue;

        const timeDiff = nextTx.timestamp - currentTx.timestamp;
        if (timeDiff > config.timeThresholdSeconds || timeDiff < 0) continue;

        if (currentTx.usd_value > 0 && nextTx.usd_value > 0) {
            const absValueDiff = Math.abs(nextTx.usd_value - currentTx.usd_value);
            const relativeDiff = absValueDiff / currentTx.usd_value;
            if (relativeDiff > config.amountThresholdPercent) continue;
        } else if (currentTx.usd_value === 0 && nextTx.usd_value === 0) {
             continue; // Cannot compare amounts if both zero
        } else {
            continue; // One is zero, one isn't - not similar
        }

        sandwichPairCount++;
        if (sandwichPairCount >= config.minSandwichPairs) return true;
    }
    return sandwichPairCount >= config.minSandwichPairs;
}



async function restartRunners(){
    try {
        const runners = await getAllRunners();
        const updatePromises = runners.map(runner => 
            updateRunner(runner.id, "checked", false).catch(err => {
                console.error(`Error updating runner ${runner.id}:`, err);
                throw err;
            })
        );
        await Promise.all(updatePromises);
        console.log("All runners successfully updated to unchecked.");
    } catch (err) {
        console.error("Error in restartRunners:", err);
        throw err;
    }
}

async function correctRunnerPnLForNoBuys() {
    try {
        const allWallets = await getAllWallets();
        if (!allWallets || allWallets.length === 0) {
            console.log("[CorrectPnL] No wallets found to process.");
            return;
        }

        console.log(`[CorrectPnL] Found ${allWallets.length} wallets. Checking runner PnL for no-buy scenarios...`);
        let walletsUpdatedCount = 0;

        for (const wallet of allWallets) {
            if (!wallet || !wallet.id || !wallet.runners || !Array.isArray(wallet.runners) || wallet.runners.length === 0) {
                // console.log(`[CorrectPnL] Skipping wallet (ID: ${wallet?.id || 'N/A'}, Address: ${wallet?.address || 'N/A'}) due to missing ID, runners, or invalid format.`);
                continue; 
            }

            let walletModified = false;
            for (const runner of wallet.runners) {
                if (runner && runner.transactions) {
                    const buys = runner.transactions.buy || [];
                    const sells = runner.transactions.sell || [];

                    const hasActualBuys = buys.length > 0;
                    const hasActualSells = sells.length > 0;

                    // Check if PnL needs to be zeroed and if it's not already zero (or undefined/null)
                    if (!hasActualBuys && hasActualSells && runner.pnl !== 0) {
                        console.log(`[CorrectPnL] Wallet ${wallet.address} (ID: ${wallet.id}), Runner (Symbol: ${runner.symbol || 'N/A'}, Coin: ${runner.address}): Has ${sells.length} sells, ${buys.length} buys. Current PnL: ${runner.pnl}. Setting to 0.`);
                        runner.pnl = 0;
                        walletModified = true;
                    }
                }
            }

            if (walletModified) {
                try {
                    await updateWallet(wallet.id, 'runners', wallet.runners);
                    walletsUpdatedCount++;
                    console.log(`[CorrectPnL] Wallet ${wallet.address} (ID: ${wallet.id}) updated in DB with corrected runner PnLs.`);
                } catch (dbError) {
                    console.error(`[CorrectPnL] Failed to update wallet ${wallet.address} (ID: ${wallet.id}) in DB:`, dbError);
                }
            }
        }
        console.log(`[CorrectPnL] Finished. ${walletsUpdatedCount} wallets had their runners' PnL potentially updated.`);

    } catch (error) {
        console.error("[CorrectPnL] Error in correctRunnerPnLForNoBuys:", error);
    }
}

async function deleteLowActivityWallets() {
    try {
        const allWallets = await getAllWallets();
        if (!allWallets || allWallets.length === 0) {
            console.log("[DeleteLowValueTx] No wallets found to process.");
            return;
        }

        console.log(`[DeleteLowValueTx] Found ${allWallets.length} wallets. Checking for transactions less than $5 USD...`);
        let walletsDeletedCount = 0;

        for (const wallet of allWallets) {
            if (!wallet || !wallet.id || !wallet.runners || !Array.isArray(wallet.runners)) {
                console.log(`[DeleteLowValueTx] Skipping wallet (ID: ${wallet?.id || 'N/A'}, Address: ${wallet?.address || 'N/A'}) due to missing ID or runners.`);
                continue;
            }

            let shouldDeleteWallet = false;
            for (const runner of wallet.runners) {
                if (runner && runner.transactions) {
                    const buys = runner.transactions.buy || [];
                    const sells = runner.transactions.sell || [];

                    // Check buy transactions
                    for (const buyTx of buys) {
                        const usdValue = (buyTx.amount || 0) * (buyTx.price || 0);
                        if (usdValue < 5) {
                            console.log(`[DeleteLowValueTx] Wallet ${wallet.address} (ID: ${wallet.id}) marked for deletion. Runner (Symbol: ${runner.symbol || 'N/A'}, Coin: ${runner.address || 'N/A'}) has a buy transaction with USD value: ${usdValue.toFixed(2)}.`);
                            shouldDeleteWallet = true;
                            break; // Break from buy transactions loop
                        }
                    }
                    if (shouldDeleteWallet) break; // Break from runners loop if wallet is already marked

                    // Check sell transactions
                    for (const sellTx of sells) {
                        const usdValue = (sellTx.amount || 0) * (sellTx.price || 0);
                        if (usdValue < 5) {
                            console.log(`[DeleteLowValueTx] Wallet ${wallet.address} (ID: ${wallet.id}) marked for deletion. Runner (Symbol: ${runner.symbol || 'N/A'}, Coin: ${runner.address || 'N/A'}) has a sell transaction with USD value: ${usdValue.toFixed(2)}.`);
                            shouldDeleteWallet = true;
                            break; // Break from sell transactions loop
                        }
                    }
                    if (shouldDeleteWallet) break; // Break from runners loop if wallet is already marked
                }
                 if (shouldDeleteWallet) break; // Ensure we break from the outer loop if a condition is met in the inner one.
            }

            if (shouldDeleteWallet) {
                try {
                    await deleteWalletById(wallet.id);
                    walletsDeletedCount++;
                    console.log(`[DeleteLowValueTx] Wallet ${wallet.address} (ID: ${wallet.id}) deleted.`);
                } catch (dbError) {
                    console.error(`[DeleteLowValueTx] Failed to delete wallet ${wallet.address} (ID: ${wallet.id}) from DB:`, dbError);
                }
            }
        }
        console.log(`[DeleteLowValueTx] Finished. ${walletsDeletedCount} wallets deleted.`);

    } catch (error) {
        console.error("[DeleteLowValueTx] Error in deleteLowActivityWallets:", error);
    }
}

async function adjustHighWalletConfidenceScores() {
    try {
        const allWallets = await getAllWallets();
        if (!allWallets || allWallets.length === 0) {
            console.log("[AdjustScores] No wallets found to process.");
            return;
        }

        console.log(`[AdjustScores] Found ${allWallets.length} wallets. Checking for confidence scores > 20 to adjust...`);
        let walletsUpdatedCount = 0;
        let walletsLoggedCount = 0; // Counter for logging

        for (const wallet of allWallets) {
            const originalRawScore = wallet.confidence_score; // Keep for debug log
            const scoreAsNumber = parseFloat(wallet.confidence_score);

            // Temporary logging for the first few wallets
            if (walletsLoggedCount < 10) { // Log details for the first 10 wallets
                console.log(`[AdjustScores DEBUG] Wallet ID: ${wallet?.id}, Raw_Score: ${originalRawScore}, Type_Raw: ${typeof originalRawScore}, Parsed_Score: ${scoreAsNumber}, Type_Parsed: ${typeof scoreAsNumber}`);
                walletsLoggedCount++;
            }

            if (!wallet || !wallet.id || typeof scoreAsNumber !== 'number' || isNaN(scoreAsNumber)) {
                if (walletsLoggedCount <= 10) { // Also log if a potentially scorable wallet is skipped early
                     console.log(`[AdjustScores DEBUG] SKIPPING Wallet ID: ${wallet?.id} due to invalid ID or score post-parsing. Raw_Score: ${originalRawScore}, Parsed_Score: ${scoreAsNumber}`);
                }
                continue;
            }

            let currentScore = scoreAsNumber; // Use the parsed number for logic
            const originalScoreForLogic = scoreAsNumber; // Keep the parsed original for logging comparison
            let scoreModified = false;

            if (currentScore > 20) {
                while (currentScore > 20) {
                    currentScore /= 2;
                    scoreModified = true;
                }
            }

            if (scoreModified) {
                try {
                    await updateWallet(wallet.id, 'confidence_score', currentScore); // Save the numerically adjusted score
                    walletsUpdatedCount++;
                    console.log(`[AdjustScores] Wallet ${wallet.address} (ID: ${wallet.id}) confidence_score updated from ${originalScoreForLogic.toFixed(4)} to ${currentScore.toFixed(4)}.`);
                } catch (dbError) {
                    console.error(`[AdjustScores] Failed to update confidence_score for wallet ${wallet.address} (ID: ${wallet.id}) in DB:`, dbError);
                }
            }
        }
        console.log(`[AdjustScores] Finished. ${walletsUpdatedCount} wallets had their confidence_score adjusted.`);

    } catch (error) {
        console.error("[AdjustScores] Error in adjustHighWalletConfidenceScores:", error);
    }
}

// restartRunners().then(() => console.log("Restarted runners"))
adjustHighWalletConfidenceScores().then(() => console.log("[AdjustScores] Completed confidence score adjustment."));
correctRunnerPnLForNoBuys().then(() => console.log("[CorrectPnL] Completed PnL correction for no-buy scenarios."));
// deleteLowActivityWallets().then(() => console.log("[DeleteLowActivity] Completed deletion of low activity wallets."));

// removeMev().then(() => console.log("Removed MEV wallets"))