const { PublicKey } = require('@solana/web3.js');
const {connection} = require("./connection.js")


const getAccountInfo= async (publicKeyString) => {
    try {
        const publicKey = new PublicKey(publicKeyString);
        const accountInfo = await connection.getParsedAccountInfo(publicKey);
        
        return accountInfo.value?.data.parsed.info
    } catch (error) {
        console.error("Error fetching token account data:", error);
    }
};

module.exports = getAccountInfo

