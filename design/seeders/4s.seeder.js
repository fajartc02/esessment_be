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
            db.query(`DELETE FROM ${table.tb_r_4s_main_schedules} CASCADE`),
            db.query(`DELETE FROM ${table.tb_r_4s_sub_schedules} CASCADE`),
            db.query(`DELETE FROM ${table.tb_r_4s_schedule_sign_checkers} CASCADE`),
            db.query(`DELETE FROM ${table.tb_r_4s_schedule_item_check_kanbans} CASCADE`),

            db.query(`ALTER TABLE ${table.tb_r_4s_main_schedules} ALTER COLUMN main_schedule_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_r_4s_sub_schedules} ALTER COLUMN sub_schedule_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_r_4s_schedule_sign_checkers} ALTER COLUMN sign_checker_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_r_4s_schedule_item_check_kanbans} ALTER COLUMN schedule_item_check_kanban_id RESTART WITH 1`),
        ]).then((res) => {
            console.log('delete and reset count complete')
        })

    }
    await queryTransaction(async (db) => {
        await clearRows(db)

        //#region schedules
        const scheduleQuery = await db.query(`select * from ${table.tb_m_schedules} where date_part('month', "date" )::integer = 3`)
        const scheduleRows = scheduleQuery.rows
        //#endregion

        /* kanban_id: kanbanRows[5].kanban_id,
            zone_id: zoneRows[2].zone_id,
                freq_id: freqRows[0].freq_id, */

        const kanbanQuery = await db.query(`select * from ${table.tb_m_kanbans}`)
        const kanbanRows = kanbanQuery.rows

        const zoneQuery = await db.query(`select * from ${table.tb_m_zones}`)
        const zoneRows = zoneQuery.rows

        const freqQuery = await db.query(`select * from ${table.tb_m_freqs}`)
        const freqRows = freqQuery.rows

        const lineGroupQuery = await db.query(`
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
        const lineGroupRows = lineGroupQuery.rows

        for (let index = 0; index < lineGroupRows.length; index++)
        {
            const lineGroup = lineGroupRows[index];

            //#region seeder 4s plan
            const mainScheduleSchema = await bulkToSchema([
                {
                    uuid: uuid(),
                    group_id: lineGroup.group_id,
                    line_id: lineGroup.line_id,
                    month_num: 3,
                    year_num: 2024,
                },
            ])

            const mainScheduleQuery = await db.query(`insert into ${table.tb_r_4s_main_schedules} (${mainScheduleSchema.columns}) VALUES ${mainScheduleSchema.values} returning *`)
            const mainScheduleRows = mainScheduleQuery.rows
            console.log('main schedule', 'inserted')
            //#endregion

            //#region users
            const userQuery = await db.query(`select * from ${table.tb_m_users} limit 10`)
            const userRows = userQuery.rows
            //#endregion

            //#region seeder clean schedules
            let countSch1 = 0, countSch2 = 0, countSch3 = 0, countSch4 = 0,
                countSch5 = 0, countSch6 = 0, countSch7 = 0, countSch8 = 0

            for (let i = 0; i < scheduleRows.length; i++)
            {
                const schedule = scheduleRows[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        main_schedule_id: mainScheduleRows[0].main_schedule_id,
                        kanban_id: kanbanRows[0].kanban_id,
                        zone_id: zoneRows[0].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_sub_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch1++
            }

            for (let i = 0; i < scheduleRows.length; i++)
            {
                const schedule = scheduleRows[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        main_schedule_id: mainScheduleRows[0].main_schedule_id,
                        kanban_id: kanbanRows[1].kanban_id,
                        zone_id: zoneRows[0].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_sub_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch2++
            }

            for (let i = 0; i < scheduleRows.length; i++)
            {
                const schedule = scheduleRows[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        main_schedule_id: mainScheduleRows[0].main_schedule_id,
                        kanban_id: kanbanRows[2].kanban_id,
                        zone_id: zoneRows[0].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_sub_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch3++
            }

            for (let i = 0; i < scheduleRows.length; i++)
            {
                const schedule = scheduleRows[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        main_schedule_id: mainScheduleRows[0].main_schedule_id,
                        kanban_id: kanbanRows[3].kanban_id,
                        zone_id: zoneRows[0].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_sub_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch4++
            }

            for (let i = 0; i < scheduleRows.length; i++)
            {
                const schedule = scheduleRows[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        main_schedule_id: mainScheduleRows[0].main_schedule_id,
                        kanban_id: kanbanRows[4].kanban_id,
                        zone_id: zoneRows[2].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_sub_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch5++
            }

            for (let i = 0; i < scheduleRows.length; i++)
            {
                const schedule = scheduleRows[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        main_schedule_id: mainScheduleRows[0].main_schedule_id,
                        kanban_id: kanbanRows[5].kanban_id,
                        zone_id: zoneRows[2].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_sub_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch6++
            }

            for (let i = 0; i < scheduleRows.length; i++)
            {
                const schedule = scheduleRows[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        main_schedule_id: mainScheduleRows[0].main_schedule_id,
                        kanban_id: kanbanRows[6].kanban_id,
                        zone_id: zoneRows[3].zone_id,
                        freq_id: freqRows[1].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_sub_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch7++
            }

            for (let i = 0; i < scheduleRows.length; i++)
            {
                const schedule = scheduleRows[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        main_schedule_id: mainScheduleRows[0].main_schedule_id,
                        kanban_id: kanbanRows[7].kanban_id,
                        zone_id: zoneRows[3].zone_id,
                        freq_id: freqRows[1].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_sub_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch8++
            }

            console.log('schedules 1', `inserted ${countSch1}`)
            console.log('schedules 2', `inserted ${countSch2}`)
            console.log('schedules 3', `inserted ${countSch3}`)
            console.log('schedules 4', `inserted ${countSch4}`)
            console.log('schedules 5', `inserted ${countSch5}`)
            console.log('schedules 6', `inserted ${countSch6}`)
            console.log('schedules 7', `inserted ${countSch7}`)
            console.log('schedules 8', `inserted ${countSch8}`)
            console.log('total schedule inserted', countSch1
                + countSch2
                + countSch3
                + countSch4
                + countSch5
                + countSch6
                + countSch7
                + countSch8
            )
            //#endregion

            const itemCheckKanbans = await bulkToSchema([
                {
                    uuid: uuid(),
                    main_schedule_id: mainScheduleRows[0].main_schedule_id,
                    item_check_kanban_id: '',
                    actual_time: 5,
                    judgement: 'OK',
                    checked_date: '2024-03-01',
                }
            ])
        }

        console.log('Seeder Completed!!!')
    }).then((res) => {
        process.exit()
    }).catch((err) => {
        process.exit()
    })
}

migrate()