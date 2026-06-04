const pg = require('pg')

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false,
}

pg.defaults.poolSize = 250;

const databasePool = new pg.Pool({
    ...config,
    idleTimeoutMillis: 30000,      // 30 detik
    connectionTimeoutMillis: 5000,  // 5 detik
    max: 200,
    application_name: 'easessment-ops-app'
})

// Handle unexpected errors on idle pool clients to prevent silent connection leak
databasePool.on('error', (err, client) => {
    console.error('[DB POOL] Unexpected error on idle client:', err.message);
})

// Log pool stats every 5 minutes to monitor connection usage
setInterval(() => {
    console.log(`[DB POOL MONITOR] total: ${databasePool.totalCount}, idle: ${databasePool.idleCount}, waiting: ${databasePool.waitingCount}`);
}, 5 * 60 * 1000).unref();

// Wrapper database replacing the single pg.Client transparently to use the pool
const database = {
    query: function (text, params, callback) {
        return databasePool.query(text, params, callback);
    },
    connect: function () {
        console.log('Verifying DB connection pool...');
        return databasePool.connect().then(client => {
            client.release(); // Release immediately back to the pool
            console.log('DB Pool connected and verified successfully');
        }).catch(err => {
            console.error('DB Pool Connection Error:', err);
        });
    },
    on: function (event, listener) {
        return databasePool.on(event, listener);
    }
};


const types = pg.types;
types.setTypeParser(1114, (stringValue) => {
    return stringValue; //1114 for time without timezone type
});

types.setTypeParser(1082, (stringValue) => {
    return stringValue;  //1082 for date type
});

module.exports = {
    database,
    databasePool
}