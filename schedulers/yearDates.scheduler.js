const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })


const moment = require('moment')
const { uuid } = require('uuidv4')
const pg = require('pg')

const { databasePool } = require('../config/database')
const table = require('../config/table')
const { queryTransaction } = require('../helpers/query')
const { generateMonthlyDates } = require('../helpers/date')
const { holidayRequest } = require('../helpers/externalRequest')
const { bulkToSchema } = require('../helpers/schema')

console.log('env', {
    env: process.env.NODE_ENV,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false
})

console.log(`4S Schedule Date Scheduler Running .....`)

const currentDate = moment()
const currentYear = currentDate.year()

//#region scheduler generateSchedules
/**
 * 
 * @param {databasePool} db 
 * @returns 
 */
const generateSchedules = async (db) => {
    const result = []

    for (let monthIndex = 1; monthIndex <= 12; monthIndex++)
    {
        const exists = await db.query(
            `
                select 
                    count(*) 
                from 
                    ${table.tb_m_schedules} 
                where 
                    date_part('month', date) = ${monthIndex} 
                    and date_part('year', date) = ${currentYear}
            `
        )

        if (exists.rowCount > 0)
        {
            continue
        }

        const currentMonthHoldayResp = await holidayRequest(currentYear, monthIndex)
        const currentMonthDays = generateMonthlyDates(currentYear, monthIndex)

        const currentMonthHolidayData = currentMonthHoldayResp.data
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

            currentMonthDay.uuid = uuid()
            result.push(currentMonthDay)
        }
    }

    const scheduleSchema = await bulkToSchema(result)
    //console.log('result', result)
    const scheduleQuery = await db.query(`insert into ${table.tb_m_schedules} (${scheduleSchema.columns}) VALUES ${scheduleSchema.values} returning *`)
    const scheduleRows = scheduleQuery.rows
    console.log('schedules', 'inserted')

    return scheduleRows
}
//#endregion

//#region scheduler delete all for testing purpose
const clear4sRows = async () => {
    if (process.env.NODE_ENV.trim() == 'dev' || process.env.NODE_ENV.trim() == 'local')
    {
        console.log('clearing start')
        await databasePool.query(`SET session_replication_role = 'replica'`)

        await databasePool.query(`DELETE FROM ${table.tb_m_schedules} CASCADE`)
        await databasePool.query(`ALTER TABLE ${table.tb_m_schedules} ALTER COLUMN schedule_id RESTART WITH 1`)

        await databasePool.query(`SET session_replication_role = 'origin'`)
        console.log('clearing succeed')
    }
}
//#endregion

const main = async () => {
    await queryTransaction(async (db) => {
        await generateSchedules(db)
    })
}

/* clear4sRows()
    .then((r) => {
        main()
            .then((result) => {
                process.exit()
            })
            .catch((error) => {
                process.exit()
            })
    })
    .catch((error) => {
        process.exit()
    }) */


main()
    .then((result) => {
        process.exit()
    })
    .catch((error) => {
        process.exit()
    })