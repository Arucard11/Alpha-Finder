// Configuration for sandwich bot detection (keep this accessible)
const sandwichConfig = {
    minTotalTransactions: 4,
    timeThresholdSeconds: 60,
    amountThresholdPercent: 0.30,
    minSandwichPairs: 1
};

/**
 * Helper function to detect potential sandwich bot behavior for a specific set of transactions.
 * NOTE: Modified slightly to accept 'transactions' object directly instead of a full 'runner'
 */
function isPotentialSandwichPattern(transactions, config) {
    // Directly use the passed 'transactions' object
    const buys = transactions?.buy || [];
    const sells = transactions?.sell || [];
    const totalTransactions = buys.length + sells.length;

    if (totalTransactions < config.minTotalTransactions) return false;

    // --- Calculate USD value and combine/sort transactions ---
    // Important: Ensure your buy/sell transaction objects have 'amount', 'price', and 'timestamp'
    const allTxns = [
        ...buys.map(tx => ({
            ...tx,
            type: 'buy',
            // Ensure default values if amount/price might be missing/null/undefined
            usd_value: (tx.amount || 0) * (tx.price || 0),
            timestamp: tx.timestamp
        })),
        ...sells.map(tx => ({
            ...tx,
            type: 'sell',
            usd_value: (tx.amount || 0) * (tx.price || 0),
            timestamp: tx.timestamp
        }))
    ];

    // Filter out transactions without a valid timestamp
    const validTxns = allTxns.filter(tx => typeof tx.timestamp === 'number' && !isNaN(tx.timestamp) && tx.timestamp > 0);
    if (validTxns.length < config.minTotalTransactions) return false; // Re-check after filtering invalid timestamps

    validTxns.sort((a, b) => a.timestamp - b.timestamp);

    // --- Logic to find sandwich pairs (same as before) ---
    let sandwichPairCount = 0;
    for (let i = 0; i < validTxns.length - 1; i++) {
        const currentTx = validTxns[i];
        const nextTx = validTxns[i + 1];

        // Must be alternating types
        if (currentTx.type === nextTx.type) continue;

        const timeDiff = nextTx.timestamp - currentTx.timestamp;
        // Must be within time threshold (and positive)
        if (timeDiff <= 0 || timeDiff > config.timeThresholdSeconds) continue;

        // Must have comparable, positive USD values
        if (currentTx.usd_value > 0 && nextTx.usd_value > 0) {
            const absValueDiff = Math.abs(nextTx.usd_value - currentTx.usd_value);
            const relativeDiff = absValueDiff / currentTx.usd_value;
            // Must be within amount threshold
            if (relativeDiff > config.amountThresholdPercent) continue;
        } else {
            // If one or both values are zero or negative, they aren't a comparable pair for this logic
             continue;
        }

        // If all checks pass, it's a potential sandwich pair component
        sandwichPairCount++;

        // Optimization: If we've found enough pairs, we can stop early
        if (sandwichPairCount >= config.minSandwichPairs) return true;
    }

    // Return true only if the minimum number of pairs was found
    return sandwichPairCount >= config.minSandwichPairs;
}


/**
 * Cleans up early buyers based on several criteria, including potential sandwich activity.
 */
function cleanUpEarlyBuyers(earlyBuyers) {
    const walletsToDelete = [];

    for (let [wallet, transactions] of Object.entries(earlyBuyers)) {
        if (wallet === "mintInfo") continue; // Skip mint info

        // Check 3: Total buy volume < $50 AND no sells
        const totalBuys = transactions.buy ? transactions.buy.reduce((acc, curr) => acc + ((curr.amount || 0) * (curr.price || 0)), 0) : 0;
        const hasSells = transactions.sell && transactions.sell.length > 0;
        if (totalBuys < 50 && !hasSells) {
            walletsToDelete.push(wallet);
            continue;
        }
    }

    for (const wallet of walletsToDelete) {
        delete earlyBuyers[wallet];
    }

    return earlyBuyers;
}

module.exports = cleanUpEarlyBuyers;