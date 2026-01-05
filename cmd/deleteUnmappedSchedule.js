const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const pg = require('pg')
const {
    deleteUnmappedFromSchedule
} = require('../services/4s.services')

//#region scheduler main
const main = async () => {
    const config = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        host: process.env.DB_HOST,
        ssl: false
    };

    console.log('env', config);

    let client = null;
    try {
        const pool = new pg.Pool(config);
        client = await pool.connect();
        await deleteUnmappedFromSchedule(client, 100);
    } catch (error) {
        console.log('error final 4s generate schedule, scheduler running', error);
    } finally {
        if (client) {
            client.release();
        }
        process.exit();
    }
}
//#endregion


main();