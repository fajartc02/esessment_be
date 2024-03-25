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
            db.query(`DELETE FROM ${table.tb_m_4s_opt_changes} CASCADE`),
            db.query(`DELETE FROM ${table.tb_m_4s_opt_depts} CASCADE`),
            db.query(`DELETE FROM ${table.tb_m_4s_evaluations} CASCADE`),


            db.query(`ALTER TABLE ${table.tb_m_4s_opt_changes} ALTER COLUMN opt_change_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_m_4s_opt_depts} ALTER COLUMN opt_dept_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_m_4s_evaluations} ALTER COLUMN evaluation_id RESTART WITH 1`),
        ]).then((res) => {
            console.log('delete and reset count complete')
        })
    }

    await queryTransaction(async (db) => {
        await clearRows(db)

        //#region finding4sMst insert tb_m_4s_opt_changes
        const optChangeSchema = await bulkToSchema([
            {
                uuid: uuid(),
                opt_nm: 'Perubahan Item Check'
            },
            {
                uuid: uuid(),
                opt_nm: 'Perubahan Kanban'
            }
        ])

        await db.query(`insert into ${table.tb_m_4s_opt_changes} (${optChangeSchema.columns}) VALUES ${optChangeSchema.values} returning *`)
        console.log('tb_m_4s_opt_changes', 'inserted')
        //#endregion

        //#region finding4sMst insert tb_m_4s_opt_depts
        const optDeptSchema = await bulkToSchema([
            {
                uuid: uuid(),
                dept_nm: 'Produksi'
            },
            {
                uuid: uuid(),
                dept_nm: 'Kaizen'
            },
            {
                uuid: uuid(),
                dept_nm: 'Maintenance'
            },
            {
                uuid: uuid(),
                dept_nm: 'Engginering'
            }
        ])

        await db.query(`insert into ${table.tb_m_4s_opt_depts} (${optDeptSchema.columns}) VALUES ${optDeptSchema.values} returning *`)
        console.log('tb_m_4s_opt_depts', 'inserted')
        //#endregion

        //#region finding4sMst insert tb_m_4s_evaluations
        const evaluationSchema = await bulkToSchema([
            {
                uuid: uuid(),
                evaluation_nm: 'Order Part'
            },
            {
                uuid: uuid(),
                evaluation_nm: 'Countermeasure'
            },
            {
                uuid: uuid(),
                evaluation_nm: 'Monitor/Follow'
            },
            {
                uuid: uuid(),
                evaluation_nm: 'Finish'
            }
        ])

        await db.query(`insert into ${table.tb_m_4s_evaluations} (${evaluationSchema.columns}) VALUES ${evaluationSchema.values} returning *`)
        console.log('tb_m_4s_evaluations', 'inserted')
        //#endregion

        console.log('Seeder Completed!!!')
    }).then((res) => {
        process.exit()
    }).catch((err) => {
        process.exit()
    })
}

migrate()