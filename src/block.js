const SHA256 = require('crypto-js/sha256');
const hex2ascii = require('hex2ascii');

function encode(data) {
    // Note: it seems Buffer.from('º').toString('hex') becomes 2 characters 0xc2ba (which decodes back to "Âº" by hex2ascii) instead of 0xba.
    return Array.from(JSON.stringify(data)).map(c => c.charCodeAt(0).toString(16)).join("");
}

function decode(hex) {
    return JSON.parse(hex2ascii(hex));
}

class Block {

    /**
     * Constructor of the Block class. The data attribute is encoded.
     */
	constructor(data){
		this.hash = null;
		this.height = 0;
		this.body = encode(data);
		this.time = 0;
		this.previousBlockHash = null;
    }
    
    /**
     *  Validates the block 
     */
    async validate() {
        return Block.hashBlock(this) === this.hash;
    }

    /**
     *  Returns the decoded block data.
     */
    getBData() {
        return decode(this.body);
    }

    // Only hashes the 4 relevant attributes of a block, so the existence of the 'hash' field does not affect the hash when validating.
    static hashBlock(block) {
        return SHA256(JSON.stringify({
            height: block.height,
            body: block.body,
            time: block.time,
            previousBlockHash: block.previousBlockHash,
        })).toString();
    }

}

module.exports.Block = Block;
