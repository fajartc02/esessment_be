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
                group_id: 2,
                start_date: '2024-04-01',
                end_date: '2024-04-05',
                shift_type: 'morning_shift',
                is_holiday: null,
                holiday_desc: null,
                all_day: true,
                title: 'RED'
            },
            {
                uuid: uuid(),
                group_id: 3,
                start_date: '2024-04-01',
                end_date: '2024-04-05',
                shift_type: 'night_shift',
                is_holiday: null,
                holiday_desc: null,
                all_day: true,
                title: 'WHITE'
            },
            {
                uuid: uuid(),
                group_id: null,
                start_date: '2024-04-08',
                end_date: '2024-04-09',
                shift_type: null,
                is_holiday: true,
                holiday_desc: 'Cuti Bersama Lebaran',
                all_day: true,
                title: 'Cuti Bersama Lebaran'
            },
            {
                uuid: uuid(),
                group_id: null,
                start_date: '2024-04-12',
                end_date: '2024-04-12',
                shift_type: null,
                is_holiday: true,
                holiday_desc: 'Cuti Bersama Test',
                all_day: true,
                title: 'Cuti Bersama Test'
            },
            {
                uuid: uuid(),
                group_id: null,
                start_date: '2024-04-15',
                end_date: '2024-04-15',
                shift_type: null,
                is_holiday: true,
                holiday_desc: 'Libur Lebaran',
                all_day: true,
                title: 'Libur Lebaran'
            },
            {
                uuid: uuid(),
                group_id: 2,
                start_date: '2024-04-16',
                end_date: '2024-04-19',
                shift_type: 'night_shift',
                is_holiday: null,
                holiday_desc: null,
                all_day: true,
                title: 'RED'
            },
            {
                uuid: uuid(),
                group_id: 3,
                start_date: '2024-04-16',
                end_date: '2024-04-19',
                shift_type: 'morning_shift',
                is_holiday: null,
                holiday_desc: null,
                all_day: true,
                title: 'WHITE'
            },
            {
                uuid: uuid(),
                group_id: 2,
                start_date: '2024-04-22',
                end_date: '2024-04-26',
                shift_type: 'morning_shift',
                is_holiday: null,
                holiday_desc: null,
                all_day: true,
                title: 'RED'
            },
            {
                uuid: uuid(),
                group_id: 3,
                start_date: '2024-04-22',
                end_date: '2024-04-26',
                shift_type: 'night_shift',
                is_holiday: null,
                holiday_desc: null,
                all_day: true,
                title: 'WHITE'
            },
            {
                uuid: uuid(),
                group_id: 2,
                start_date: '2024-04-29',
                end_date: '2024-05-03',
                shift_type: 'night_shift',
                is_holiday: null,
                holiday_desc: null,
                all_day: true,
                title: 'RED'
            },
            {
                uuid: uuid(),
                group_id: 3,
                start_date: '2024-04-29',
                end_date: '2024-05-03',
                shift_type: 'morning_shift',
                is_holiday: null,
                holiday_desc: null,
                all_day: true,
                title: 'WHITE'
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