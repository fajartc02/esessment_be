const nodeEnv = (process.env.NODE_ENV || 'local').trim()
const envFilePath = nodeEnv == 'production'
    ? './.env'
    : (nodeEnv == 'dev' ? './dev.env' : './local.env')
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
        ssl: false,
        application_name: 'delete-unmapped-schedule-script'
    };

    console.log('env', config);

    let client = null;
    try {
        const pool = new pg.Pool(config);
        client = await pool.connect();
        await deleteUnmappedFromSchedule(client, 1000);
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