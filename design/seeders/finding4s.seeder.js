const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const { uuid } = require('uuidv4');
const { Pool } = require('pg');
const { databasePool } = require('../../config/database');
const table = require('../../config/table')
const moment = require('moment')
const { queryTransaction } = require('../../helpers/query')
const { bulkToSchema } = require('../../helpers/schema')

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

const migrate = async () => {
    const clearRows = async (db) => {
        await Promise.all([
            db.query(`DELETE FROM ${table.tb_r_4s_findings} CASCADE`),

            db.query(`ALTER TABLE ${table.tb_r_4s_findings} ALTER COLUMN finding_id RESTART WITH 1`),
        ]).then((res) => {
            console.log('delete and reset count complete')
        })
    }

    await queryTransaction(async (db) => {
        await clearRows(db)

        

       
        console.log('Seeder Completed!!!')
    }).then((res) => {
        process.exit()
    }).catch((err) => {
        process.exit()
    })
}

migrate()