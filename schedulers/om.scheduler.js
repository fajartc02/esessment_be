const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })


const moment = require('moment')
const { uuid } = require('uuidv4')
const pg = require('pg')

const { databasePool, database } = require('../config/database')
const table = require('../config/table')
const { bulkToSchema } = require('../helpers/schema')
const logger = require('../helpers/logger')
const { getRandomInt, padTwoDigits } = require('../helpers/formatting')
const { nonShift } = require('../services/shift.services')
const { lineGroupRows } = require('../services/common.services')
const {
    genMonthlySubScheduleSchemaOM,
    genMonthlySignCheckerSchemaOM,
    findScheduleTransactionOM,
    findSignCheckerTransactionOM,
    clearOmTransactionRows
} = require("../services/om.services")

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
const currentMonth = currentDate.month() + 1 // need +1 to determine current month
const currentYear = currentDate.year()
const flagCreatedBy = `SCHEDULERS ${currentDate.format('YYYY-MM-DD')}`

const main = async () => {
    try
    {
        database.connect((err) => {
            console.log('database already connected');
        })

        //#region schedulers parent 
        const lineGroups = await lineGroupRows(currentYear, currentMonth)
        const shiftRows = await nonShift(currentYear, currentMonth)
        const mainScheduleBulkSchema = []
        const subScheduleBulkSchema = []
        const signCheckerTlBulkSchema = []
        const signChckerGlBulkSchema = []

        for (let lgIndex = 0; lgIndex < lineGroups.length; lgIndex++)
        {
            const findMain = await findScheduleTransactionOM(
                currentYear,
                currentMonth,
                lineGroups[lgIndex].line_id,
                lineGroups[lgIndex].group_id
            )
            console.log('findMain', findMain);
            if (!findMain)
            {
                mainScheduleBulkSchema.push({
                    uuid: uuid(),
                    month_num: currentMonth,
                    year_num: currentYear,
                    line_id: lineGroups[lgIndex].line_id,
                    group_id: lineGroups[lgIndex].group_id,
                })
            }

            const subScheduleBulk = await genMonthlySubScheduleSchemaOM(currentYear, currentMonth, lineGroups[lgIndex], shiftRows)
            const signCheckers = await genMonthlySignCheckerSchemaOM(currentYear, currentMonth, lineGroups[lgIndex], shiftRows)

            if (subScheduleBulk.length > 0)
            {
                subScheduleBulkSchema.push(...subScheduleBulk)
            }
            if (signCheckers.tl.length > 0)
            {
                signCheckerTlBulkSchema.push(...signCheckers.tl)
            }
            if (signCheckers.gl.length > 0)
            {

                signChckerGlBulkSchema.push(...signCheckers.gl)
            }
        }
        //#endregion

        console.log('mainScheduleBulkSchema length', mainScheduleBulkSchema.length);
        if (mainScheduleBulkSchema.length > 0)
        {
            const mSchema = await bulkToSchema(mainScheduleBulkSchema)
            await database.query(
                `insert into ${table.tb_r_om_main_schedules} (${mSchema.columns}) values ${mSchema.values} returning *`)
            console.log('tb_r_om_main_schedules', 'inserted')
        }

        const mainScheduleInserted = await findScheduleTransactionOM(currentYear, currentMonth)
        console.log('subScheduleBulkSchema length', subScheduleBulkSchema.length);
        console.log('signCheckerTlBulkSchema length', signCheckerTlBulkSchema.length);
        console.log('signChckerGlBulkSchema length', signChckerGlBulkSchema.length);

        //console.log('subScheduleBulkSchema', subScheduleBulkSchema[0]);

        let countInsertSub = 0
        let countInsertSign = 0

        for (let mIndex = 0; mIndex < mainScheduleInserted.length; mIndex++)
        {
            //#region scheduler generate om_main_schedule_id for subScheduleBulkSchema
            for (let subIndex = 0; subIndex < subScheduleBulkSchema.length; subIndex++)
            {
                if (
                    subScheduleBulkSchema[subIndex].line_id == mainScheduleInserted[mIndex].line_id
                    && subScheduleBulkSchema[subIndex].group_id == mainScheduleInserted[mIndex].group_id
                )
                {
                    const checkExisting = await findScheduleTransactionOM(
                        currentYear,
                        currentMonth,
                        mainScheduleInserted[mIndex].line_id,
                        mainScheduleInserted[mIndex].group_id,
                        subScheduleBulkSchema[subIndex].freq_id,
                        subScheduleBulkSchema[subIndex].machine_id,
                        subScheduleBulkSchema[subIndex].om_item_check_kanban_id,
                        subScheduleBulkSchema[subIndex].schedule_id
                    )

                    //console.log('checkExisting', checkExisting);

                    const sSchema = await bulkToSchema([
                        {
                            uuid: uuid(),
                            om_main_schedule_id: mainScheduleInserted[mIndex].om_main_schedule_id,
                            om_item_check_kanban_id: subScheduleBulkSchema[subIndex].om_item_check_kanban_id,
                            machine_id: subScheduleBulkSchema[subIndex].machine_id,
                            freq_id: subScheduleBulkSchema[subIndex].freq_id,
                            schedule_id: subScheduleBulkSchema[subIndex].schedule_id,
                            plan_time: subScheduleBulkSchema[subIndex].plan_time,
                            is_holiday: subScheduleBulkSchema[subIndex].is_holiday,
                        }
                    ])

                    const sqlInSub = `insert into ${table.tb_r_om_sub_schedules} (${sSchema.columns}) values ${sSchema.values}`

                    if (!checkExisting)
                    {
                        //console.log('sqlInSub', sqlInSub);
                        await database.query(sqlInSub)
                        countInsertSub += 1
                    }
                    else
                    {
                        //console.log('skip sub schedule', subScheduleBulkSchema[subIndex]);
                    }
                }
            }
            //#endregion

            //#region scheduler combine all sign checker schema
            for (let tl1Index = 0; tl1Index < signCheckerTlBulkSchema.length; tl1Index++)
            {
                if (
                    signCheckerTlBulkSchema[tl1Index].group_id == mainScheduleInserted[mIndex].group_id
                    && signCheckerTlBulkSchema[tl1Index].line_id == mainScheduleInserted[mIndex].line_id
                )
                {
                    const checkExisting = await findSignCheckerTransactionOM(
                        currentYear,
                        currentMonth,
                        mainScheduleInserted[mIndex].line_id,
                        mainScheduleInserted[mIndex].group_id,
                        signCheckerTlBulkSchema[tl1Index].start_date,
                        signCheckerTlBulkSchema[tl1Index].end_date,
                        true
                    )

                    const sgSchema = await bulkToSchema([
                        {
                            om_main_schedule_id: mainScheduleInserted[mIndex].om_main_schedule_id,
                            uuid: uuid(),
                            start_date: signCheckerTlBulkSchema[tl1Index].start_date,
                            end_date: signCheckerTlBulkSchema[tl1Index].end_date,
                            is_tl: true,
                            is_gl: null,
                            created_by: flagCreatedBy,
                        }
                    ])

                    const sqlInSign = `insert into ${table.tb_r_om_schedule_sign_checkers} (${sgSchema.columns}) values ${sgSchema.values}`

                    if (!checkExisting || (checkExisting?.length ?? 0) == 0)
                    {

                        //console.log('sqlInSign', sqlInSign);
                        await database.query(sqlInSign)
                        countInsertSign += 1
                    }
                    else
                    {
                        //console.log('tb_r_4s_schedule_sign_checkers', 'skipped! tl1', sqlInSign)
                    }
                }
            }

            for (let glIndex = 0; glIndex < signChckerGlBulkSchema.length; glIndex++)
            {
                if (
                    signChckerGlBulkSchema[glIndex].group_id == mainScheduleInserted[mIndex].group_id
                    && signChckerGlBulkSchema[glIndex].line_id == mainScheduleInserted[mIndex].line_id
                )
                {
                    const checkExisting = await findSignCheckerTransactionOM(
                        currentYear,
                        currentMonth,
                        mainScheduleInserted[mIndex].line_id,
                        mainScheduleInserted[mIndex].group_id,
                        signChckerGlBulkSchema[glIndex].start_date,
                        signChckerGlBulkSchema[glIndex].end_date,
                        true
                    )

                    const sgSchema = await bulkToSchema([
                        {
                            om_main_schedule_id: mainScheduleInserted[mIndex].om_main_schedule_id,
                            uuid: uuid(),
                            start_date: signChckerGlBulkSchema[glIndex].start_date,
                            end_date: signChckerGlBulkSchema[glIndex].end_date,
                            is_tl: null,
                            is_gl: true,
                            created_by: flagCreatedBy,
                        }
                    ])

                    const sqlInSign = `insert into ${table.tb_r_om_schedule_sign_checkers} (${sgSchema.columns}) values ${sgSchema.values}`

                    if (!checkExisting || (checkExisting?.length ?? 0) == 0)
                    {

                        //console.log('sqlInSign', sqlInSign);
                        await database.query(sqlInSign)
                        countInsertSign += 1
                        //console.log('tb_r_4s_schedule_sign_checkers', 'inserted tl1')
                    }
                    else
                    {
                        //console.log('tb_r_4s_schedule_sign_checkers', 'skipped! tl1', sqlInSign)
                    }
                }
            }
            //#endregion
        }

        console.log('countinsert sub', countInsertSub);
        console.log('countinsert sign', countInsertSign);
    }
    catch (error)
    {
        await clearOmTransactionRows(flagCreatedBy)
        console.log('error om generate schedule, scheduler running', error)
    }
    finally
    {
        /* database.end((e) => {
            console.log('error end', e);
        }) */
    }
}

/* main()
    .then(() => {
        logger(`successfully run om.scheduler for month=${currentMonth}-${currentYear}`)
        process.exit()
    })
    .catch((e) => {
        logger(`error clearOmTransactionRows() om.scheduler for month=${currentMonth}-${currentYear}`, {
            data: e
        })
        process.exit()
    }) */

module.exports = main