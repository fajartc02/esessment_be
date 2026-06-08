const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const { uuid } = require('uuidv4');
const { Pool } = require('pg');
const { databasePool } = require('../../config/database');
const table = require('../../config/table')
const { bulkToSchema } = require('../../helpers/schema')
const { getRandomInt } = require('../../helpers/formatting')

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

const clearRows = async (db) => {
    await db.query(`SET session_replication_role = 'replica'`)

    await db.query(`DELETE FROM ${table.tb_m_4s_item_check_kanbans} CASCADE`)
    await db.query(`ALTER TABLE ${table.tb_m_4s_item_check_kanbans} ALTER COLUMN item_check_kanban_id RESTART WITH 1`)

    await db.query(`SET session_replication_role = 'origin'`)
    console.log('delete and reset count complete')

}

/**
 * summary 4sItemCheck seeder
 * getRandomInt 1 - 30 is id from assyline seeder
 * 
 * @param {databasePool} db
 * @returns {Promise<void>}
 */
const itemCheckSeeder = async (db) => {
    await clearRows(db)

    //#region item check
    const itemCheckSchema = await bulkToSchema([
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Pipa M/C Kawata',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Panel M/C Kawata',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Lantai',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Roller Oil Pan',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Rotari Table',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Daily Transfer',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Jig Lubang Pin HD',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Lantai',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Jalur Hijau',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Garis Kuning',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Zebra Cross',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Stiker Tunjuk Arah Kanan',
            standart_time: 5
        },
        {
            uuid: uuid(),
            kanban_id: getRandomInt(1, 30),
            item_check_nm: 'Stiker IN/OUT',
            standart_time: 5
        },
    ])

    await db.query(`insert into ${table.tb_m_4s_item_check_kanbans} (${itemCheckSchema.columns}) VALUES ${itemCheckSchema.values} returning *`)
    console.log('item check kanbans', 'inserted')
    //#endregion
}

module.exports = itemCheckSeeder