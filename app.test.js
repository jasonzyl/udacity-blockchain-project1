const express = require("express");
const bodyParser = require("body-parser");
const request = require("supertest");
const bitcoinMessage = require('bitcoinjs-message');
const bitcoin = require('bitcoinjs-lib');

const BlockChain = require("./src/blockchain");
const createBlockchainController = require("./BlockchainController");

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

const STAR_SIRIUS = {
	dec: "-16º 42' 58",
	ra: "6h 45m 9s",
	story: "Sirius"
};
const STAR_VEGA = {
	dec: "38º 47' 1",
	ra: "18h 36m 56s",
	story: "Vega"
}
const STAR_BETELGEUSE = {
	dec: "7º 24' 25",
	ra: "5h 55m 10s",
	story: "Betelgeuse"
}

async function addStar(star, keyPair) {
	const response1 = await request(BASE_URL).post("/requestValidation").send({address: getAddress(keyPair)});
	expect(response1.statusCode).toBe(200);
	const message = response1.body;
	const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
	const signature = bitcoinMessage.sign(message, keyPair.privateKey, keyPair.compressed).toString('base64');
	const response2 = await request(BASE_URL).post("/submitstar").send({
		message,
		signature,
		address,
		star: star
	});
	expect(response2.statusCode).toBe(200);
}

function getAddress(keyPair) {
	return bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey }).address;
}

describe("Blockchain test", () => { 
	let server;
	let blockchain;

	beforeEach(() => {
		// Creates a simple test server and saves it to server. Uses a new server for each test.
		const app = express();
		blockchain = new BlockChain.Blockchain();
		app.use(bodyParser.urlencoded({extended:true}));
		app.use(bodyParser.json());
		createBlockchainController(app, blockchain);
		server = app.listen(PORT);
	});

	afterEach(() => {
		// Shuts down the server.
		server.close();
	});

	test("Genesis block exists", async () => {
		const response = await request(BASE_URL).get("/block/height/0");
		expect(response.statusCode).toBe(200);
		const block = response.body;
		expect(block).toBeDefined;
		expect(block.hash.length).toBe(64);
		expect(block.body).toBeTruthy();
		expect(parseInt(block.time)).toBeGreaterThan(0);
		expect(block.previousBlockHash).toBeNull();
	});

	test("Submit one star successfully", async () => {
		const keyPair = bitcoin.ECPair.makeRandom();

		// First step, call /requestValidation to get the message to be signed.
		const response1 = await request(BASE_URL).post("/requestValidation").send({address: getAddress(keyPair)});
		expect(response1.statusCode).toBe(200);
		const message = response1.body;

		// Signs the message with bitcoin private key
		const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
		const signature = bitcoinMessage.sign(message, keyPair.privateKey, keyPair.compressed).toString('base64');

		// Submits the star
		const response2 = await request(BASE_URL).post("/submitstar").send({
			message,
			signature,
			address,
			star: STAR_SIRIUS
		});
		expect(response2.statusCode).toBe(200);

		// Gets the star by address.
		const response3 = await request(BASE_URL).get(`/blocks/${address}`);
		expect(response3.statusCode).toBe(200);
		const stars = response3.body;
		expect(stars.length).toBe(1);
		expect(stars[0]).toEqual({
			owner: address,
			star: STAR_SIRIUS
		});
	});

	test("Submit one star fails with stale timestamp", async () => {
		const keyPair = bitcoin.ECPair.makeRandom();

		// First step, call /requestValidation to get the message to be signed.
		const response1 = await request(BASE_URL).post("/requestValidation").send({address: getAddress(keyPair)});
		expect(response1.statusCode).toBe(200);
		let message = response1.body;
		// Modifies the message to be 10 minutes ago.
		let messageTokens = message.split(":");
		messageTokens[1] = (parseInt(messageTokens[1]) - 600).toString();
		message = messageTokens.join(":");

		// Signs the message with bitcoin private key
		const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
		const signature = bitcoinMessage.sign(message, keyPair.privateKey, keyPair.compressed).toString('base64');

		// Submits the star
		const response2 = await request(BASE_URL).post("/submitstar").send({
			message,
			signature,
			address,
			star: STAR_SIRIUS
		});
		expect(response2.statusCode).toBe(500);
	});

	test("Submit one star fails after tampering", async () => {
		const keyPair = bitcoin.ECPair.makeRandom();

		// First step, call /requestValidation to get the message to be signed.
		const response1 = await request(BASE_URL).post("/requestValidation").send({address: getAddress(keyPair)});
		expect(response1.statusCode).toBe(200);
		let message = response1.body;
		// Modifies the message to be 10 minutes ago.
		let messageTokens = message.split(":");
		messageTokens[1] = (parseInt(messageTokens[1]) - 600).toString();
		message = messageTokens.join(":");

		// Signs the message with bitcoin private key
		const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
		const signature = bitcoinMessage.sign(message, keyPair.privateKey, keyPair.compressed).toString('base64');

		// Tamper the genesis block
		blockchain.chain[0].hash = "12345";

		// Submits the star
		const response2 = await request(BASE_URL).post("/submitstar").send({
			message,
			signature,
			address,
			star: STAR_SIRIUS
		});
		expect(response2.statusCode).toBe(500);
	});

	test("Multiple stars with different owners", async() => {
		const keyPair1 = bitcoin.ECPair.makeRandom();
		const keyPair2 = bitcoin.ECPair.makeRandom();

		await addStar(STAR_SIRIUS, keyPair1);
		await addStar(STAR_VEGA, keyPair2);
		await addStar(STAR_BETELGEUSE, keyPair1);

		const stars1 = (await request(BASE_URL).get(`/blocks/${getAddress(keyPair1)}`)).body;
		const stars2 = (await request(BASE_URL).get(`/blocks/${getAddress(keyPair2)}`)).body;

		expect(stars1).toEqual([{owner: getAddress(keyPair1), star: STAR_SIRIUS}, {owner: getAddress(keyPair1), star: STAR_BETELGEUSE}]);
		expect(stars2).toEqual([{owner: getAddress(keyPair2), star: STAR_VEGA}]);
	});

	test("Get blocks by height", async () => {
		const keyPair = bitcoin.ECPair.makeRandom();
		await addStar(STAR_SIRIUS, keyPair);
		await addStar(STAR_VEGA, keyPair);

		const block1 = (await request(BASE_URL).get('/block/height/1')).body;
		const block2 = (await request(BASE_URL).get('/block/height/2')).body;

		expect(block1.height).toBe(1);
		expect(block2.height).toBe(2);
	});

	test("Get blocks by hash", async () => {
		const keyPair = bitcoin.ECPair.makeRandom();
		await addStar(STAR_SIRIUS, keyPair);
		await addStar(STAR_VEGA, keyPair);

		const block = (await request(BASE_URL).get('/block/height/1')).body;
		const blockByHash = (await request(BASE_URL).get(`/block/hash/${block.hash}`)).body;
		expect(blockByHash).toEqual(block);
	});

	test("Validate chain succeed", async () => {
		const keyPair = bitcoin.ECPair.makeRandom();
		await addStar(STAR_SIRIUS, keyPair);
		await addStar(STAR_VEGA, keyPair);
		await addStar(STAR_BETELGEUSE, keyPair);

		const response = await request(BASE_URL).get('/validate');
		expect(response.statusCode).toBe(200);
	});

	test("Validate chain fails after tampering", async () => {
		const keyPair = bitcoin.ECPair.makeRandom();
		await addStar(STAR_SIRIUS, keyPair);
		await addStar(STAR_VEGA, keyPair);
		await addStar(STAR_BETELGEUSE, keyPair);
		blockchain.chain[1].hash = "12345";

		const response = await request(BASE_URL).get('/validate');
		expect(response.statusCode).toBe(500);
	});
});

