const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const table = require('../../config/table')
const { queryTransaction } = require('../../helpers/query')

console.log('env', {
    env: process.env.NODE_ENV,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false
})

console.log(`Migration Running ...`)

const clearRows = async () => {
    await queryTransaction(async (db) => {
        await db.query(`SET session_replication_role = 'replica'`)

        await db.query(`DELETE FROM ${table.tb_r_om_findings} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_r_om_findings} ALTER COLUMN om_finding_id RESTART WITH 1`)

        await db.query(`DELETE FROM ${table.tb_r_om_schedule_sign_checkers} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_r_om_schedule_sign_checkers} ALTER COLUMN om_sign_checker_id RESTART WITH 1`)

        await db.query(`DELETE FROM ${table.tb_r_om_sub_schedules} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_r_om_sub_schedules} ALTER COLUMN om_sub_schedule_id RESTART WITH 1`)

        await db.query(`DELETE FROM ${table.tb_r_om_main_schedules} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_r_om_main_schedules} ALTER COLUMN om_main_schedule_id RESTART WITH 1`)

        console.log('delete and reset count complete')
        await db.query(`SET session_replication_role = 'origin'`)
    })
        .then((res) => {
            process.exit()
        })
        .catch((err) => {
            console.log('====================================');
            console.log('clear rows failed', err);
            console.log('====================================');
            process.exit()
        })
}

clearRows()