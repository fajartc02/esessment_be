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

const currentDate = moment()
const currentYear = currentDate.year()

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
        console.log('clearing start')
        await db.query(`SET session_replication_role = 'replica'`)

        await db.query(`DELETE FROM ${table.tb_m_shifts} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_m_shifts} ALTER COLUMN shift_id RESTART WITH 1`)

        await db.query(`SET session_replication_role = 'origin'`)
        console.log('delete and reset count complete')
    }

    await queryTransaction(async (db) => {
        await clearRows(db)

        //#region finding4sMst insert tb_m_system
        const schema = await bulkToSchema([
            {
                uuid: uuid(),
                group_id: '',
                start_date: '',
                end_date: '',
                shift_type: null,
                is_holiday: null,
                holiday_desc: null,
            },
        ])

        await db.query(`insert into ${table.tb_m_shifts} (${schema.columns}) VALUES ${schema.values}`)
        console.info('tb_m_shifts', 'inserted')
        //#endregion

        console.info('Seeder Completed!!!')
    }).then((res) => {
        process.exit()
    }).catch((err) => {
        console.error('err', err)
        process.exit()
    })
}

migrate()