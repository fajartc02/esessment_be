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
const { bulkToSchema } = require('./seederHelper')

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

//#region generateSchedules
const generateSchedules = async (db) => {
    const currentMonthHoldayResp = await holidayRequest(currentDate.year(), currentDate.month() + 1)
    const currentMonthDays = generateMonthlyDates(currentDate.year(), currentDate.month() + 1)
    
    const nextMonthHolidayResp = await holidayRequest(currentDate.year(), currentDate.month() + 2)
    const nextMonthDays = generateMonthlyDates(currentDate.year(), currentDate.month() + 2)

    const currentMonthHolidayData = currentMonthHoldayResp.data
    const nextMonthHolidayData = nextMonthHolidayResp.data
    const result = []

    for (let i = 0; i < currentMonthDays.length; i++)
    {
        const currentMonthDay = currentMonthDays[i];

        for (let j = 0; j < currentMonthHolidayData.length; j++)
        {
            const holiday = currentMonthHolidayData[j];
            if (currentMonthDay.date == holiday.holiday_date)
            {
                currentMonthDay.is_holiday = true
                currentMonthDay.holiday_nm = holiday.holiday_name
                break
            }
        }

        if (!currentMonthDay.is_holiday)
        {
            currentMonthDay.is_holiday = false
        }
        if (!currentMonthDay.holiday_nm)
        {
            currentMonthDay.holiday_nm = null
        }

        currentMonthDay.week_pos = Math.ceil(moment(currentMonthDay.date).date() / 7)
        currentMonthDay.uuid = uuid()
        result.push(currentMonthDay)
    }

    for (let i = 0; i < nextMonthDays.length; i++)
    {
        const nextMonthDay = nextMonthDays[i];

        for (let j = 0; j < nextMonthHolidayData.length; j++)
        {
            const holiday = nextMonthHolidayData[j];
            if (nextMonthDay.date == holiday.holiday_date)
            {
                nextMonthDay.is_holiday = true
                nextMonthDay.holiday_nm = holiday.holiday_name
                break
            }
        }

        if (!nextMonthDay.is_holiday)
        {
            nextMonthDay.is_holiday = false
        }
        if (!nextMonthDay.holiday_nm)
        {
            nextMonthDay.holiday_nm = null
        }

        nextMonthDay.week_pos = Math.ceil(moment(nextMonthDay.date).date() / 7)
        nextMonthDay.uuid = uuid()
        result.push(nextMonthDay)
    }

    const scheduleSchema = await bulkToSchema(result)
    //console.log('result', scheduleSchema)
    const scheduleQuery = await db.query(`insert into ${table.tb_m_schedules} (${scheduleSchema.columns}) VALUES ${scheduleSchema.values} returning *`)
    const scheduleRows = scheduleQuery.rows
    console.log('schedules', 'inserted')

    return scheduleRows
}
//#endregion

const migrate = async () => {
    const clearRows = async (db) => {
        await Promise.all([
            db.query(`DELETE FROM ${table.tb_m_kanbans} CASCADE`),
            db.query(`DELETE FROM ${table.tb_m_zones} CASCADE`),
            db.query(`DELETE FROM ${table.tb_m_freqs} CASCADE`),
            db.query(`DELETE FROM ${table.tb_m_4s_members} CASCADE`),
            db.query(`DELETE FROM ${table.tb_m_roles} CASCADE`),
            db.query(`DELETE FROM ${table.tb_m_schedules} CASCADE`),

            db.query(`DELETE FROM ${table.tb_r_4s_plans} CASCADE`),
            db.query(`DELETE FROM ${table.tb_r_4s_schedules} CASCADE`),
            db.query(`DELETE FROM ${table.tb_r_4s_revisions} CASCADE`),
            db.query(`DELETE FROM ${table.tb_r_4s_checkers} CASCADE`),

            db.query(`ALTER TABLE ${table.tb_m_kanbans} ALTER COLUMN kanban_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_m_zones} ALTER COLUMN zone_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_m_freqs} ALTER COLUMN freq_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_m_roles} ALTER COLUMN role_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_m_schedules} ALTER COLUMN schedule_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_m_4s_members} ALTER COLUMN member_4s_id RESTART WITH 1`),

            db.query(`ALTER TABLE ${table.tb_r_4s_plans} ALTER COLUMN plan_4s_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_r_4s_schedules} ALTER COLUMN schedule_4s_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_r_4s_revisions} ALTER COLUMN revision_4s_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_r_4s_checkers} ALTER COLUMN checker_4s_id RESTART WITH 1`),
        ]).then((res) => {
            console.log('delete and reset count complete')
        })

    }
    await queryTransaction(async (db) => {
        await clearRows(db)

        //#region lines
        //die casting
        const lineGroups = await db.query(`
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
                freq_nm: 'Daily',
            },
            {
                uuid: uuid(),
                freq_nm: 'Weekly',
            },
            {
                uuid: uuid(),
                freq_nm: 'Monthly',
            },
        ])
        const freqQuery = await db.query(`insert into ${table.tb_m_freqs} (${freqSchema.columns}) VALUES ${freqSchema.values} returning *`)
        const freqRows = freqQuery.rows
        console.log('freqs', 'inserted')
        //#endregion

        //#region zones
        const zoneSchema = await bulkToSchema([
            {
                uuid: uuid(),
                zone_nm: 'Zone 1',
            },
            {
                uuid: uuid(),
                zone_nm: 'Zone 2',

            },
            {
                uuid: uuid(),
                zone_nm: 'Zone 3',
            },
            {
                uuid: uuid(),
                zone_nm: 'Zone 4',
            },
        ])
        const zoneQuery = await db.query(`insert into ${table.tb_m_zones} (${zoneSchema.columns}) VALUES ${zoneSchema.values} returning *`)
        const zoneRows = zoneQuery.rows
        console.log('zones', 'inserted')
        //#endregion

        //#region roles
        const roleSchema = await bulkToSchema([
            {
                uuid: uuid(),
                role_nm: 'Section Head'
            },
            {
                uuid: uuid(),
                role_nm: 'Line Head'
            },
            {
                uuid: uuid(),
                role_nm: 'Team Leader'
            },
            {
                uuid: uuid(),
                role_nm: 'Pic'
            },
        ])
        await db.query(`insert into ${table.tb_m_roles} (${roleSchema.columns}) VALUES ${roleSchema.values} returning *`)
        console.log('roles', 'inserted')
        //#endregion

        //#region members
        const memberSchema = await bulkToSchema([
            {
                uuid: uuid(),
                role_id: 4,
                user_id: 1,
            },
            {
                uuid: uuid(),
                role_id: 4,
                user_id: 2,
            },
            {
                uuid: uuid(),
                role_id: 4,
                user_id: 3,
            },
            {
                uuid: uuid(),
                role_id: 4,
                user_id: 4,
            },
            {
                uuid: uuid(),
                role_id: 4,
                user_id: 5,
            },
            {
                uuid: uuid(),
                role_id: 4,
                user_id: 6,
            },
            {
                uuid: uuid(),
                role_id: 4,
                user_id: 7,
            },
            {
                uuid: uuid(),
                role_id: 1,
                user_id: 8,
            },
            {
                uuid: uuid(),
                role_id: 2,
                user_id: 9,
            },
            {
                uuid: uuid(),
                role_id: 3,
                user_id: 10,
            },
        ])
        await db.query(`insert into ${table.tb_m_4s_members} (${memberSchema.columns}) VALUES ${memberSchema.values} returning *`)
        console.log('members', 'inserted')
        //#endregion

        const memberIdQuery = await db.query(`
        with
            sh as (
                select
                    member_4s_id as section_head_id
                from
                    tb_m_4s_members
                where
                    role_id = (select role_id from tb_m_roles where "lower"(role_nm) = 'section head')
            ),
            lh as (
                select
                    member_4s_id as line_head_id
                from
                    tb_m_4s_members
                where
                    role_id = (select role_id from tb_m_roles where "lower"(role_nm) = 'line head')
            ),
            tl as (
                select
                    member_4s_id as team_leader_id
                from
                    tb_m_4s_members
                where
                    role_id = (select role_id from tb_m_roles where "lower"(role_nm) = 'team leader')
            )

            select * from sh, lh, tl
        `)
        const memberIdRows = memberIdQuery.rows[0]

        //#region schedules
        const schedules = await generateSchedules(db)
        //#endregion

        for (let index = 0; index < lineGroupRows.length; index++)
        {
            const lineGroup = lineGroupRows[index];

            //#region seeder kanban
            const kanbanSchema = await bulkToSchema([
                {
                    uuid: uuid(),
                    line_id: lineGroup.line_id,
                    kanban_nm: 'C-01-05',
                    area_nm: 'Baritori & Visual Checks',
                },
                {
                    uuid: uuid(),
                    line_id: lineGroup.line_id,
                    kanban_nm: 'C-01-08',
                    area_nm: 'Lantai Mesin DC #2 (B)',
                },
                {
                    uuid: uuid(),
                    line_id: lineGroup.line_id,
                    kanban_nm: 'C-01-15',
                    area_nm: 'Mesin Die Cast #2 (C)',
                },
                {
                    uuid: uuid(),
                    line_id: lineGroup.line_id,
                    kanban_nm: 'C-01-18',
                    area_nm: 'Area Robot (D)',
                },
                {
                    uuid: uuid(),
                    line_id: lineGroup.line_id,
                    kanban_nm: 'C-02-08',
                    area_nm: 'Mesin Bubut (A)',
                },
                {
                    uuid: uuid(),
                    line_id: lineGroup.line_id,
                    kanban_nm: 'C-03-02',
                    area_nm: 'Meja Kerja Naturium (B)',
                },
                {
                    uuid: uuid(),
                    line_id: lineGroup.line_id,
                    kanban_nm: 'C-01-01',
                    area_nm: 'CMM Room (A)',
                },
                {
                    uuid: uuid(),
                    line_id: lineGroup.line_id,
                    kanban_nm: 'C-02-01',
                    area_nm: 'Roller To Room (B)',
                }
            ]);
            const kanbanQuery = await db.query(`insert into ${table.tb_m_kanbans} (${kanbanSchema.columns}) VALUES ${kanbanSchema.values} returning *`)
            const kanbanRows = kanbanQuery.rows
            console.log('kanbans', 'inserted')
            //#endregion

            //#region seeder 4s plan
            const cpSchema = await bulkToSchema([
                {
                    uuid: uuid(),
                    group_id: lineGroup.group_id,
                    line_id: lineGroup.line_id,
                    month: 'Maret',
                    year: 2024,
                    section_head_id: memberIdRows.section_head_id,
                    line_head_id: memberIdRows.line_head_id,
                    team_leader_id: memberIdRows.team_leader_id
                },
            ])
            const cpQuery = await db.query(`insert into ${table.tb_r_4s_plans} (${cpSchema.columns}) VALUES ${cpSchema.values} returning *`)
            const cpRows = cpQuery.rows
            console.log('clean plan', 'inserted')
            //#endregion

            //#region users
            const userQuery = await db.query(`select * from ${table.tb_m_4s_members} where role_id = (select role_id from tb_m_roles where lower(role_nm) = 'pic')`)
            const userRows = userQuery.rows
            //#endregion

            //#region seeder clean schedules
            let countSch1 = 0, countSch2 = 0, countSch3 = 0, countSch4 = 0,
                countSch5 = 0, countSch6 = 0, countSch7 = 0, countSch8 = 0

            for (let i = 0; i < schedules.length; i++)
            {
                const schedule = schedules[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        plan_4s_id: cpRows[0].plan_4s_id,
                        pic_id: userRows[0].user_id,
                        kanban_id: kanbanRows[0].kanban_id,
                        zone_id: zoneRows[0].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch1++
            }

            for (let i = 0; i < schedules.length; i++)
            {
                const schedule = schedules[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        plan_4s_id: cpRows[0].plan_4s_id,
                        pic_id: userRows[1].user_id,
                        kanban_id: kanbanRows[1].kanban_id,
                        zone_id: zoneRows[0].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch2++
            }

            for (let i = 0; i < schedules.length; i++)
            {
                const schedule = schedules[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        plan_4s_id: cpRows[0].plan_4s_id,
                        pic_id: userRows[2].user_id,
                        kanban_id: kanbanRows[2].kanban_id,
                        zone_id: zoneRows[0].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch3++
            }

            for (let i = 0; i < schedules.length; i++)
            {
                const schedule = schedules[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        plan_4s_id: cpRows[0].plan_4s_id,
                        pic_id: userRows[3].user_id,
                        kanban_id: kanbanRows[3].kanban_id,
                        zone_id: zoneRows[0].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch4++
            }

            for (let i = 0; i < schedules.length; i++)
            {
                const schedule = schedules[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        plan_4s_id: cpRows[0].plan_4s_id,
                        pic_id: userRows[4].user_id,
                        kanban_id: kanbanRows[4].kanban_id,
                        zone_id: zoneRows[2].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch5++
            }

            for (let i = 0; i < schedules.length; i++)
            {
                const schedule = schedules[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        plan_4s_id: cpRows[0].plan_4s_id,
                        pic_id: userRows[5].user_id,
                        kanban_id: kanbanRows[5].kanban_id,
                        zone_id: zoneRows[2].zone_id,
                        freq_id: freqRows[0].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch6++
            }

            for (let i = 0; i < schedules.length; i++)
            {
                const schedule = schedules[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        plan_4s_id: cpRows[0].plan_4s_id,
                        pic_id: userRows[6].user_id,
                        kanban_id: kanbanRows[6].kanban_id,
                        zone_id: zoneRows[3].zone_id,
                        freq_id: freqRows[1].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
                countSch7++
            }

            for (let i = 0; i < schedules.length; i++)
            {
                const schedule = schedules[i];

                const sSchema = await bulkToSchema([
                    {
                        uuid: uuid(),
                        plan_4s_id: cpRows[0].plan_4s_id,
                        pic_id: userRows[0].user_id,
                        kanban_id: kanbanRows[7].kanban_id,
                        zone_id: zoneRows[3].zone_id,
                        freq_id: freqRows[1].freq_id,
                        schedule_id: schedule.schedule_id,
                    },
                ])
                await db.query(`insert into ${table.tb_r_4s_schedules} (${sSchema.columns}) VALUES ${sSchema.values} returning *`)
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
            console.log('total schedule inserted', countSch1 + countSch2 + countSch3
                + countSch4 + countSch5 + countSch6 + countSch7 + countSch8)
            //#endregion
        }

        console.log('Seeder Completed!!!')
    }, () => {
        process.exit()
    }).then((res) => {
        process.exit()
    })
}

migrate()