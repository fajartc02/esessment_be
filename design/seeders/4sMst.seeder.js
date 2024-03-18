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

        currentMonthDay.week_num = `func date_part('week', '${currentMonthDay.date}'::date)`
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

        nextMonthDay.week_pos = `func date_part('week', '${nextMonthDay.date}'::date)`
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
            db.query(`DELETE FROM ${table.tb_m_schedules} CASCADE`),
            db.query(`DELETE FROM ${table.tb_m_4s_item_check_kanbans} CASCADE`),

            db.query(`ALTER TABLE ${table.tb_m_kanbans} ALTER COLUMN kanban_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_m_zones} ALTER COLUMN zone_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_m_freqs} ALTER COLUMN freq_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_m_schedules} ALTER COLUMN schedule_id RESTART WITH 1`),
            db.query(`ALTER TABLE ${table.tb_m_4s_item_check_kanbans} ALTER COLUMN item_check_kanban_id RESTART WITH 1`),
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

        //#region generate schedule
        await generateSchedules(db)
        //#endregion

        for (let index = 0; index < lineGroupRows.length; index++)
        {
            const lineGroup = lineGroupRows[index];

            //#region zones
            const zoneSchema = await bulkToSchema([
                {
                    uuid: uuid(),
                    zone_nm: 'Zone 1',
                    line_id: lineGroup.line_id,
                },
                {
                    uuid: uuid(),
                    zone_nm: 'Zone 2',
                    line_id: lineGroup.line_id,
                },
                {
                    uuid: uuid(),
                    zone_nm: 'Zone 3',
                    line_id: lineGroup.line_id,
                },
                {
                    uuid: uuid(),
                    zone_nm: 'Zone 4',
                    line_id: lineGroup.line_id,
                },
            ])
            const zoneQuery = await db.query(`insert into ${table.tb_m_zones} (${zoneSchema.columns}) VALUES ${zoneSchema.values} returning *`)
            const zoneRows = zoneQuery.rows
            console.log('zones', 'inserted')
            //#endregion

            //#region seeder kanban
            const kanbanSchema = await bulkToSchema([
                {
                    uuid: uuid(),
                    zone_id: zoneRows[1].zone_id,
                    kanban_no: 'C-01-05',
                    area_nm: 'Baritori & Visual Checks',
                },
                {
                    uuid: uuid(),
                    zone_id: zoneRows[1].zone_id,
                    kanban_no: 'C-01-08',
                    area_nm: 'Lantai Mesin DC #2 (B)',
                },
                {
                    uuid: uuid(),
                    zone_id: zoneRows[1].zone_id,
                    kanban_no: 'C-01-15',
                    area_nm: 'Mesin Die Cast #2 (C)',
                },
                {
                    uuid: uuid(),
                    zone_id: zoneRows[1].zone_id,
                    kanban_no: 'C-01-18',
                    area_nm: 'Area Robot (D)',
                },
                {
                    uuid: uuid(),
                    zone_id: zoneRows[3].zone_id,
                    kanban_no: 'C-02-08',
                    area_nm: 'Mesin Bubut (A)',
                },
                {
                    uuid: uuid(),
                    zone_id: zoneRows[3].zone_id,
                    kanban_no: 'C-03-02',
                    area_nm: 'Meja Kerja Naturium (B)',
                },
                {
                    uuid: uuid(),
                    zone_id: zoneRows[0].zone_id,
                    kanban_no: 'C-01-01',
                    area_nm: 'CMM Room (A)',
                },
                {
                    uuid: uuid(),
                    zone_id: zoneRows[0].zone_id,
                    kanban_no: 'C-02-01',
                    area_nm: 'Roller To Room (B)',
                }
            ]);

            const kanbanQuery = await db.query(`insert into ${table.tb_m_kanbans} (${kanbanSchema.columns}) VALUES ${kanbanSchema.values} returning *`)
            const kanbanRows = kanbanQuery.rows
            console.log('kanbans', 'inserted')
            //#endregion

            //#region seeder item check kanban
            const itemCheckSchema = await bulkToSchema([
                {
                    uuid: uuid(),
                    kanban_id: kanbanRows[kanbanRows.length - 1].kanban_id,
                    item_check_nm: 'Roller, Oil Pan',
                    standart_time: 5
                },
                {
                    uuid: uuid(),
                    kanban_id: kanbanRows[kanbanRows.length - 1].kanban_id,
                    item_check_nm: 'Rotari Table',
                    standart_time: 5
                },
                {
                    uuid: uuid(),
                    kanban_id: kanbanRows[kanbanRows.length - 1].kanban_id,
                    item_check_nm: 'Dolly Transfer',
                    standart_time: 5
                },
            ])

            await db.query(`insert into ${table.tb_m_4s_item_check_kanbans} (${itemCheckSchema.columns}) VALUES ${itemCheckSchema.values} returning *`)
            console.log('item check kanbans', 'inserted')
            //#endregion
        }
    }).then((res) => {
        process.exit()
    }).catch((err) => {
        process.exit()
    })
}

migrate()