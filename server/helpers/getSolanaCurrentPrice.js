const axios = require("axios");

async function fetchSolPrice() {
    try {
        const response = await axios.get(
            `https://frontend-api-v3.pump.fun/sol-price`,
          
        );
        // Get the closest price to the transaction timestamp
        return response.data.solPrice
    } catch (error) {
        console.error("Error fetching SOL price:", error);
    }
    return null;
}

module.exports = fetchSolPrice