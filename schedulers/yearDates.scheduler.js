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


const main = async () => {
    await queryTransaction(async (db) => {
        await generateSchedules(db)
    })
}

main()
    .then((result) => {
        process.exit()
    })
    .catch((error) => {
        process.exit()
    })