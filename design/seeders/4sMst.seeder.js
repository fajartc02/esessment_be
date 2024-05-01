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
const { generateMonthlyDates } = require('../../helpers/date')
const { holidayRequest } = require('../../helpers/externalRequest')
const { bulkToSchema } = require('../../helpers/schema')
const { getRandomInt } = require('../../helpers/formatting')

const currentDate = moment()

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

    await db.query(`DELETE FROM ${table.tb_r_4s_findings} CASCADE`)
    await db.query(`ALTER TABLE ${table.tb_r_4s_findings} ALTER COLUMN finding_id RESTART WITH 1`)
    
    await db.query(`DELETE FROM ${table.tb_r_4s_schedule_item_check_kanbans} CASCADE`)
    await db.query(`ALTER TABLE ${table.tb_r_4s_schedule_item_check_kanbans} ALTER COLUMN schedule_item_check_kanban_id RESTART WITH 1`)

    await db.query(`DELETE FROM ${table.tb_m_kanbans} CASCADE`)
    await db.query(`DELETE FROM ${table.tb_m_zones} CASCADE`)
    await db.query(`DELETE FROM ${table.tb_m_freqs} CASCADE`)
    await db.query(`DELETE FROM ${table.tb_m_4s_item_check_kanbans} CASCADE`)

    await db.query(`ALTER TABLE ${table.tb_m_kanbans} ALTER COLUMN kanban_id RESTART WITH 1`)
    await db.query(`ALTER TABLE ${table.tb_m_zones} ALTER COLUMN zone_id RESTART WITH 1`)
    await db.query(`ALTER TABLE ${table.tb_m_freqs} ALTER COLUMN freq_id RESTART WITH 1`)
    await db.query(`ALTER TABLE ${table.tb_m_4s_item_check_kanbans} ALTER COLUMN item_check_kanban_id RESTART WITH 1`)

    console.log('delete and reset count complete')

    await db.query(`SET session_replication_role = 'origin'`)
}

const migrate = async () => {

    await queryTransaction(async (db) => {
        await clearRows(db)

        //#region lines
        //die casting
        /*  const lineGroups = await db.query(`
             select * from 
             (
                 select
                     line_id,
                     line_nm
                 from
                     ${table.tb_m_lines}  
                 where line_id = 4 -- DIE CASTING
             ) tml,
             (
                 select
                     group_id,
                     group_nm
                 from
                     ${table.tb_m_groups}  
                 where group_id = 3 -- WHITE
             ) tmg
         `)
         const lineGroupRows = lineGroups.rows
         //#endregion
 
         //#region freq
         const freqSchema = await bulkToSchema([
             {
                 uuid: uuid(),
                 freq_nm: '1 Day',
                 precition_val: 1,
             },
             {
                 uuid: uuid(),
                 freq_nm: '1 Week',
                 precition_val: 7,
             },
             {
                 uuid: uuid(),
                 freq_nm: '1 Month',
                 precition_val: 30,
             },
             {
                 uuid: uuid(),
                 freq_nm: '2 Month',
                 precition_val: 60,
             },
             {
                 uuid: uuid(),
                 freq_nm: '3 Month',
                 precition_val: 90,
             },
         ])
         const freqQuery = await db.query(`insert into ${table.tb_m_freqs} (${freqSchema.columns}) VALUES ${freqSchema.values} returning *`)
         const freqRows = freqQuery.rows
         console.log('freqs', 'inserted') */
        //#endregion


        for (let index = 0; index < lineGroupRows.length; index++)
        {
            const lineGroup = lineGroupRows[index];

            //#region zones
            /* const zoneSchema = await bulkToSchema([
                {
                    uuid: uuid(),
                    zone_nm: 'Zona 4',
                    line_id: lineGroup.line_id,
                },
                {
                    uuid: uuid(),
                    zone_nm: '1A-1B',
                    line_id: lineGroup.line_id,
                },
                {
                    uuid: uuid(),
                    zone_nm: 'Zona 2',
                    line_id: lineGroup.line_id,
                },
                {
                    uuid: uuid(),
                    zone_nm: 'Zona 3',
                    line_id: lineGroup.line_id,
                },
            ])

            const zoneQuery = await db.query(`insert into ${table.tb_m_zones} (${zoneSchema.columns}) VALUES ${zoneSchema.values} returning *`)
            const zoneRows = zoneQuery.rows
            console.log('zones', 'inserted') */
            //#endregion

            //#region seeder kanban
            /* let kanbanJSON = JSON.parse(`
                [
                    {
                        "zone_id": 1,
                        "freq_id": 1,
                        "kanban_no": "4.10",
                        "area_nm": "Tempat Sampah",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 2,
                        "freq_id": 2,
                        "kanban_no": "1.1",
                        "area_nm": "SST Buka CR Cap",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 4,
                        "freq_id": 4,
                        "kanban_no": "1.2",
                        "area_nm": "IMZY-0013, IMTS-0027",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 4,
                        "freq_id": 4,
                        "kanban_no": "1.4",
                        "area_nm": "IMAT-0014",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 4,
                        "freq_id": 4,
                        "kanban_no": "1.8",
                        "area_nm": "IMAT-0011",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 4,
                        "freq_id": 4,
                        "kanban_no": "1.13",
                        "area_nm": "IMAM-001",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 3,
                        "freq_id": 3,
                        "kanban_no": "2.3",
                        "area_nm": "IMAT-0041",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 3,
                        "freq_id": 3,
                        "kanban_no": "2.4",
                        "area_nm": "IMTS-0039",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 3,
                        "freq_id": 3,
                        "kanban_no": "2.5",
                        "area_nm": "IMTS-0037",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 3,
                        "freq_id": 3,
                        "kanban_no": "2.6",
                        "area_nm": "Shiffer Transfer",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 5,
                        "freq_id": 3,
                        "kanban_no": "3.2",
                        "area_nm": "IMZY-0028",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 2,
                        "freq_id": 2,
                        "kanban_no": "1.3",
                        "area_nm": "CYI Bore Cheker",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 2,
                        "freq_id": 2,
                        "kanban_no": "1.6",
                        "area_nm": "Protector Conrod",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 2,
                        "freq_id": 2,
                        "kanban_no": "1.10",
                        "area_nm": "JIG Bearing Upper",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 2,
                        "freq_id": 2,
                        "kanban_no": "1.11",
                        "area_nm": "JIG Bearing Lower",
                        "kanban_imgs": null
                    },
                    {
                        "zone_id": 5,
                        "freq_id": 3,
                        "kanban_no": "3.4",
                        "area_nm": "IMZY-002899",
                        "kanban_imgs": null
                    }
                ]
            `)

            kanbanJSON = kanbanJSON.map((item) => ({
                ...item,
                uuid: uuid(),
            }))
            const kanbanSchema = await bulkToSchema(kanbanJSON);
            await db.query(`insert into ${table.tb_m_kanbans} (${kanbanSchema.columns}) VALUES ${kanbanSchema.values} returning *`)
            console.log('kanbans', 'inserted') */
            //#endregion

            //#region seeder item check kanban

            /* const itemCheckSchema = await bulkToSchema([
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
            console.log('item check kanbans', 'inserted') */
            //#endregion
        }
    }).then((res) => {
        process.exit()
    }).catch((err) => {
        process.exit()
    })
}

//migrate()

clearRows(databasePool).then(() => process.exit()).catch((err) => {
    console.log('====================================');
    console.log('clear rows failed', err);
    console.log('====================================');
    process.exit()
})