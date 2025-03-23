 function cleanUpEarlyBuyers(earlyBuyers) {
    for (let [wallet, transactions] of Object.entries(earlyBuyers)) {
        if (wallet === "mintInfo") continue; // Skip mint info

        // If there are no buys, remove the wallet
        if (!transactions.buy || transactions.buy.length === 0) {
            delete earlyBuyers[wallet];
            continue;
        }

        // Check if all individual buys are < 50
        const allBuysBelowThreshold = transactions.buy.every(tx => (tx.amount * tx.price) < 5);

        // Calculate total buy volume
        const totalBuys = transactions.buy.reduce((acc, curr) => acc + (curr.amount * curr.price), 0);

        // Check if there are any sells
        const hasSells = transactions.sell && transactions.sell.length > 0;

        // ✅ Delete wallets where all individual buys are < 50
        // ✅ Delete wallets where total buy volume < 50 AND has no sells
        if (allBuysBelowThreshold || (totalBuys < 50 && !hasSells) || transactions.buy.length <= 15) {
            delete earlyBuyers[wallet];
        }
    }

    return earlyBuyers;
}

module.exports = cleanUpEarlyBuyers;
