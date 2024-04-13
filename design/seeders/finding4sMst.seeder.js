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
            db.query(`DELETE FROM ${table.tb_m_system} WHERE system_type in ('4S_OPT_CHANGE', 'OPT_DEPT', '4S_EVALUATION')`),
        ]).then((res) => {
            console.log('delete and reset count complete')
        })
    }

    await queryTransaction(async (db) => {
        await clearRows(db)

        //#region finding4sMst insert tb_m_system
        const systemSchema = await bulkToSchema([
            //#region finding4sMst opt_changes schema
            {
                uuid: uuid(),
                system_type: '4S_OPT_CHANGE',
                system_value: 'Perubahan Item Check'
            },
            {
                uuid: uuid(),
                system_type: '4S_OPT_CHANGE',
                system_value: 'Perubahan Kanban'
            },
            //#endregion
            //#region finding4sMst opt_depts schema
            {
                uuid: uuid(),
                system_type: 'OPT_DEPT',
                system_value: 'Produksi'
            },
            {
                uuid: uuid(),
                system_type: 'OPT_DEPT',
                system_value: 'Kaizen'
            },
            {
                uuid: uuid(),
                system_type: 'OPT_DEPT',
                system_value: 'Maintenance'
            },
            {
                uuid: uuid(),
                system_type: 'OPT_DEPT',
                system_value: 'Engginering'
            },
            //#endregion
            //#region finding4sMst evaluations schema
            {
                uuid: uuid(),
                system_type: '4S_EVALUATION',
                system_value: 'Order Part'
            },
            {
                uuid: uuid(),
                system_type: '4S_EVALUATION',
                system_value: 'Countermeasure'
            },
            {
                uuid: uuid(),
                system_type: '4S_EVALUATION',
                system_value: 'Monitor/Follow'
            },
            {
                uuid: uuid(),
                system_type: '4S_EVALUATION',
                system_value: 'Finish'
            }
            //#endregion
        ])

        await db.query(`insert into ${table.tb_m_system} (${systemSchema.columns}) VALUES ${systemSchema.values}`)
        console.log('tb_m_system 4S FINDINGS', 'inserted')
        //#endregion

        console.log('Seeder Completed!!!')
    }).then((res) => {
        process.exit()
    }).catch((err) => {
        console.log('err', err)
        process.exit()
    })
}

migrate()