const pg = require('pg')

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false
}

const database = new pg.Client(config);

/**
 * Use a pool if you have or expect to have multiple concurrent requests. 
 * That is literally what it is there for: 
 * to provide a pool of re-usable open client instances (reduces latency whenever a client can be reused).
 * usecase : transaction
 */
const databasePool = new pg.Pool(config)

module.exports = {
    database,
    databasePool
}