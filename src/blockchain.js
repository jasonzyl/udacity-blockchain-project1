const SHA256 = require('crypto-js/sha256');
const {Block} = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

function currentTimeString() {
    return new Date().getTime().toString().slice(0, -3);
}

function verifyTime(message) {
    const time = parseInt(message.split(":")[1] || "0");
    const elapsed = Math.round(new Date().getTime() / 1000) - time;
    return elapsed <= 300;
} 

/**
 * Blockchain class to save stars. The chain is stored in memory.
 */
class Blockchain {

    /**
     * Constructor of the class.
     */
    constructor() {
        this.chain = [];
        this.initializeChain();
    }

    /**
     * Creates the genesis block for the first time. Saves the initialization promise so that other methods can wait on it.
     */
    initializeChain() {
        if (this.chain.length === 0) {
            let block = new Block({data: 'Genesis Block'});
            // Since we are required to keep app.js intact and app.js uses the constructor, we save the initialization promise and let all other methods await on it.
            this.initialized = this._addBlock(block);
        }
    }

    /**
     * Returns the chain height.
     */
    async getChainHeight() {
        await this.initialized;
        return this.chain.length;
    }

    /**
     * Adds the block into the chain.
     * @param {Block} block 
     */
    async _addBlock(block) {
        await this.initialized;
        block.time = currentTimeString();
        block.height = this.chain.length;
        if (this.chain.length) {
            block.previousBlockHash = this.chain[this.chain.length - 1].hash;
        }
        block.hash = Block.hashBlock(block);
        this.chain.push(block);
        return block; 
    }

    /**
     * Returns a message to be signed by Bitcoin wallet. Specific enough to prevent 
     * @param {string} address 
     */
    async requestMessageOwnershipVerification(address) {
        await this.initialized;
        return `${address}:${currentTimeString()}:starRegistry`;
    }

    /**
     * Submits the star into the blockchain if the time since the initial request is within 5 minutes, and the signature is valid.
     * @param {string} address 
     * @param {string} message 
     * @param {string} signature 
     * @param {Object} star 
     */
    async submitStar(address, message, signature, star) {
        await this.initialized;
        if (!verifyTime(message)) {
            throw 'The message is more than 5 minutes stale';
        }
        if (bitcoinMessage.verify(message, address, signature)) {
            const block = new Block({
                address,
                message,
                signature,
                star
            });
            return this._addBlock(block);
        } else {
            throw('Bitcoin message verification failed');
        }
    }

    /**
     * Returns a block by its hash if it exists, otherwise returns null.
     * @param {string} hash 
     */
    async getBlockByHash(hash) {
        await this.initialized;
        return this.chain.find(b => b.hash === hash) || null;
    }

    /**
     * Returns a block by its height if it exists, otherwise returns null.
     * @param {string} height
     */
    async getBlockByHeight(height) {
        await this.initialized;
        return this.chain[height] || null;
    }

    /**
     * Returns all stars owned by a certain wallet address.
     * @param {string} address 
     */
    async getStarsByWalletAddress(address) {
        await this.initialized;
        return this.chain.map(b => b.getBData()).filter(data => data.address === address).map(data => data.star);
    }

    /**
     * Validates the chain and returns a list of error logs. If the error log list is empty, the chain is considered to be valid.
     */
    async validateChain() {
        await this.initialized;
        let errorLog = [];
        for (let block of this.chain) {
            if (!(await block.validate())) {
                errorLog.push(`Block at height ${block.height} is invalid`);
            }
        }
        return errorLog;
    }

}

module.exports.Blockchain = Blockchain;   