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
const { bulkToSchema } = require('../helpers/schema')
const logger = require('../helpers/logger')
const { getRandomInt, padTwoDigits } = require('../helpers/formatting')
const { nonShift } = require('../services/shift.services')
const { lineGroupRows } = require('../services/common.services')
const { genMonthlySubScheduleSchemaOM, genMonthlySignCheckerSchemaOM, clearOmTransactionRows } = require("../services/om.services")

console.log('env', {
    env: process.env.NODE_ENV,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false
})

console.log(`OM Schedule Date Scheduler Running .....`)

const currentDate = moment()
const currentMonth = 5//currentDate.month() + 1 // need +1 to determine current month
const currentYear = currentDate.year()

//#region scheduler added group to mainSchedule
/**
 * @typedef {Object} mainScheduleBulkSchema
 * @property {string} uuid 
 * @property {number} month_num
 * @property {number} year_num
 * @property {number} line_id
 * @property {number} group_id
 * 
 * @param {pg.QueryResultRow} lineGroupRows
 * @returns {Promise<Array<mainScheduleBulkSchema>>}
 */
const genMainSchedule = async (lineGroup) => {
    return {
        uuid: uuid(),
        month_num: lineGroup.month_num,
        year_num: currentYear,
        line_id: lineGroup.line_id,
        group_id: lineGroup.group_id,
    }
}
//#endregion


//#region scheduler main 
const main = async () => {
    try
    {
        //#region schedulers parent 
        const lineGroups = await lineGroupRows(currentYear, currentMonth)
        const shiftRows = await nonShift(currentYear, currentMonth)
        const mainScheduleBulkSchema = []
        const subScheduleBulkSchema = []
        const signCheckerTl1BulkSchema = []
        const signChckerGlBulkSchema = []

        for (let lgIndex = 0; lgIndex < lineGroups.length; lgIndex++)
        {
            //#region scheduler bulk temp var
            const mainScheduleBulk = await genMainSchedule(lineGroups[lgIndex])
            const subScheduleBulk = await genMonthlySubScheduleSchemaOM(currentYear, currentMonth, lineGroups[lgIndex], shiftRows)
            const signCheckers = await genMonthlySignCheckerSchemaOM(currentYear, currentMonth, lineGroups[lgIndex], shiftRows)

            mainScheduleBulkSchema.push(mainScheduleBulk)
            subScheduleBulkSchema.push(...subScheduleBulk)
            if (subScheduleBulk.length > 0)
            {
                signCheckerTl1BulkSchema.push(...signCheckers.tl)
                signChckerGlBulkSchema.push(...signCheckers.gl)
            }
            //#endregion
        }
        //#endregion


        //#region scheduler transaction
        const transaction = await queryTransaction(async (db) => {
            //#region scheduler inserted tb_r_om_main_schedules
            const mSchema = await bulkToSchema(mainScheduleBulkSchema)
            const mainScheduleInserted = await db.query(
                `insert into ${table.tb_r_om_main_schedules} (${mSchema.columns}) values ${mSchema.values} returning *`)
            console.log('tb_r_om_main_schedules', 'inserted')
            //#endregion

            let subScheduleTemp = []
            let signCheckersTemp = []

            for (let mIndex = 0; mIndex < mainScheduleInserted.rows.length; mIndex++)
            {
                //#region scheduler generate om_main_schedule_id for subScheduleBulkSchema
                for (let subIndex = 0; subIndex < subScheduleBulkSchema.length; subIndex++)
                {
                    if (
                        subScheduleBulkSchema[subIndex].line_id == mainScheduleInserted.rows[mIndex].line_id
                        && subScheduleBulkSchema[subIndex].group_id == mainScheduleInserted.rows[mIndex].group_id
                    )
                    {
                        subScheduleTemp.push({
                            uuid: uuid(),
                            om_main_schedule_id: mainScheduleInserted.rows[mIndex].om_main_schedule_id,
                            om_item_check_kanban_id: subScheduleBulkSchema[subIndex].om_item_check_kanban_id,
                            machine_id: subScheduleBulkSchema[subIndex].machine_id,
                            freq_id: subScheduleBulkSchema[subIndex].freq_id,
                            schedule_id: subScheduleBulkSchema[subIndex].schedule_id,
                            plan_time: subScheduleBulkSchema[subIndex].plan_time,
                            is_holiday: subScheduleBulkSchema[subIndex].is_holiday,
                        })
                    }
                }
                //#endregion

                //#region scheduler combine all sign checker schema
                for (let tl1Index = 0; tl1Index < signCheckerTl1BulkSchema.length; tl1Index++)
                {
                    if (
                        signCheckerTl1BulkSchema[tl1Index].group_id == mainScheduleInserted.rows[mIndex].group_id
                        && signCheckerTl1BulkSchema[tl1Index].line_id == mainScheduleInserted.rows[mIndex].line_id
                    )
                    {
                        signCheckersTemp.push({
                            om_main_schedule_id: mainScheduleInserted.rows[mIndex].om_main_schedule_id,
                            uuid: uuid(),
                            start_date: signCheckerTl1BulkSchema[tl1Index].start_date,
                            end_date: signCheckerTl1BulkSchema[tl1Index].end_date,
                            is_tl: true,
                            is_gl: null,
                        })
                    }
                }

                for (let glIndex = 0; glIndex < signChckerGlBulkSchema.length; glIndex++)
                {
                    if (
                        signChckerGlBulkSchema[glIndex].group_id == mainScheduleInserted.rows[mIndex].group_id
                        && signChckerGlBulkSchema[glIndex].line_id == mainScheduleInserted.rows[mIndex].line_id
                    )
                    {
                        signCheckersTemp.push({
                            om_main_schedule_id: mainScheduleInserted.rows[mIndex].om_main_schedule_id,
                            uuid: uuid(),
                            start_date: signChckerGlBulkSchema[glIndex].start_date,
                            end_date: signChckerGlBulkSchema[glIndex].end_date,
                            is_tl: null,
                            is_gl: true,
                        })
                    }
                }
                //#endregion
            }

            //#region scheduler inserted tb_r_om_sub_schedules
            const sSchema = await bulkToSchema(subScheduleTemp)
            await db.query(`insert into ${table.tb_r_om_sub_schedules} (${sSchema.columns}) values ${sSchema.values}`)
            console.log('tb_r_om_sub_schedules', 'inserted')
            //#endregion

            //#region scheduler inserted tb_r_om_schedule_sign_checkers
            const sgSchema = await bulkToSchema(signCheckersTemp)
            await db.query(`insert into ${table.tb_r_om_schedule_sign_checkers} (${sgSchema.columns}) values ${sgSchema.values}`)
            console.log('tb_r_om_schedule_sign_checkers', 'inserted')
            //#endregion
        })
        //#endregion

        return transaction
    } catch (error)
    {
        console.log('error om generate schedule, scheduler running', error)
        throw error
    }
}
//#endregion

const test = async () => {
    //const shiftRows = await shiftByGroupId()
}

/* test()
    .then((r) => {
        return 0
    })
    .catch((e) => {
        console.error('test error', e)
        return 0
    }) */

clearOmTransactionRows()
    .then((r) => {
        main()
            .then((r) => {
                logger(`success run scheduler for month=${currentMonth}-${currentYear}`)
                return 0
            })
            .catch((e) => {
                logger(`error clearOmTransactionRows() om.scheduler for month=${currentMonth}-${currentYear}`, {
                    data: e
                })
                return 0
            })
    })
    .catch((e) => {
        logger(`error clearOmTransactionRows() om.scheduler for month=${currentMonth}-${currentYear}`, {
            data: e
        })
        return 0
    })


/* main()
    .then(() => {
        logger(`successfully run om.scheduler for month=${currentMonth}-${currentYear}`)
        process.exit()
    })
    .catch((error) => {
        logger(`error clearOmTransactionRows() om.scheduler for month=${currentMonth}-${currentYear}`, {
            data: e
        })
        process.exit()
    }) */