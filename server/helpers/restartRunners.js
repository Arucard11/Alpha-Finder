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

// restartRunners().then(() => console.log("Restarted runners"))

correctRunnerPnLForNoBuys().then(() => console.log("[CorrectPnL] Completed PnL correction for no-buy scenarios."));
// deleteLowActivityWallets().then(() => console.log("[DeleteLowActivity] Completed deletion of low activity wallets."));

// removeMev().then(() => console.log("Removed MEV wallets"))