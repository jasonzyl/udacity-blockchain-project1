# Notes

* Controller tests can be found at `app.test.js`, and it can be run by `npm run test`
* Screenshots can be found at `/screenshots`, and they are mostly using `curl`, since the commands are not that complicated.
* In the `blockchain.js`, `this.height` is eliminated, and `this.chain.length` is used instead when needed.
* In a couple of places, `async` functions are used instead of ones without the `async` keyword that returns promises. Technically `async` functions still return promises.
* The `Blockchain.initializeChain()` function is asynchronous, but it would be problematic to call other functions before the initialization is done. One solution is to initialize the `Blockchain` instances by an async factory function. However, given we are discouraged in changing `app.js`, here I'm letting all other Blockchain methods wait on a promise produced by the `initializeChain()`.
