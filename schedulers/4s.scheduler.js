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
const { shiftByGroupId } = require('../services/shift.services')
const { lineGroupRows } = require('../services/common.services')
const { genMonthlySubScheduleSchema, genMonthlySignCheckerSchema, findScheduleTransaction4S } = require('../services/4s.services')

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
const currentMonth = 4//currentDate.month() + 1 // need +1 to determine current month
const currentYear = currentDate.year()


//#region scheduler main 
const main = async () => {
    try
    {
        //#region schedulers parent 
        const lineGroups = await lineGroupRows(currentYear, currentMonth)

        const mainScheduleBulkSchema = []
        const subScheduleBulkSchema = []
        const signCheckerTl1BulkSchema = []
        const signCheckerTl2BulkSchema = []
        const signChckerGlBulkSchema = []
        const signChckerShBulkSchema = []

        for (let lgIndex = 0; lgIndex < lineGroups.length; lgIndex++)
        {
            const shiftRows = await shiftByGroupId(currentYear, currentMonth, lineGroups[lgIndex].line_id, lineGroups[lgIndex].group_id)

            //#region scheduler bulk temp var
            const find = await findScheduleTransaction4S(
                currentYear,
                currentMonth,
                lineGroups[lgIndex].line_id,
                lineGroups[lgIndex].group_id
            )

            if (!find || find.length == 0)
            {
                mainScheduleBulkSchema.push({
                    uuid: uuid(),
                    month_num: lineGroups[lgIndex].month_num,
                    year_num: currentYear,
                    line_id: lineGroups[lgIndex].line_id,
                    group_id: lineGroups[lgIndex].group_id,
                })
            }

            const subScheduleBulk = await genMonthlySubScheduleSchema(currentYear, currentMonth, lineGroups[lgIndex], shiftRows)
            const signCheckers = await genMonthlySignCheckerSchema(currentYear, currentMonth, lineGroups[lgIndex], shiftRows)
            const signCheckerTl1 = signCheckers.tl1
            const signCheckerTl2 = signCheckers.tl2
            const signChckerGl = signCheckers.gl
            const signChckerSh = signCheckers.sh

            if (subScheduleBulk.length > 0)
            {
                subScheduleBulkSchema.push(...subScheduleBulk)
            }
            if (signCheckerTl1.length > 0)
            {
                signCheckerTl1BulkSchema.push(...signCheckerTl1)
            }
            if (signCheckerTl2.length > 0)
            {
                signCheckerTl2BulkSchema.push(...signCheckerTl2)
            }
            if (signChckerGl.length > 0)
            {
                signChckerGlBulkSchema.push(...signChckerGl)
            }
            if (signChckerSh.length > 0)
            {
                signChckerShBulkSchema.push(...signChckerSh)
            }
            //#endregion
        }

        //#endregion


        //#region scheduler transaction
        const transaction = await queryTransaction(async (db) => {
            //#region scheduler inserted tb_r_4s_main_schedules
            let mainScheduleInserted = []
            if (mainScheduleBulkSchema.length > 0)
            {
                const mSchema = await bulkToSchema(mainScheduleBulkSchema)
                mainScheduleInserted = await db.query(
                    `insert into ${table.tb_r_4s_main_schedules} (${mSchema.columns}) values ${mSchema.values} returning *`)
                console.log('tb_r_4s_main_schedules', 'inserted')
                mainScheduleInserted = mainScheduleInserted.rows
            }
            else
            {
                mainScheduleInserted = await findScheduleTransaction4S(currentYear, currentMonth);
            }

            //#endregion

            let subScheduleTemp = []
            let signCheckersTemp = []

            /* logger.info('subScheduleBulkSchema', {
                meta: {
                    isJson: true,
                    message: subScheduleBulkSchema
                }
            }) */

            for (let mIndex = 0; mIndex < mainScheduleInserted.length; mIndex++)
            {
                //#region scheduler generate main_schedule_id for subScheduleBulkSchema
                if (subScheduleBulkSchema.length > 0)
                {
                    for (let subIndex = 0; subIndex < subScheduleBulkSchema.length; subIndex++)
                    {
                        if (
                            subScheduleBulkSchema[subIndex].line_id == mainScheduleInserted[mIndex].line_id
                            && subScheduleBulkSchema[subIndex].group_id == mainScheduleInserted[mIndex].group_id
                        )
                        {
                            subScheduleTemp.push({
                                uuid: uuid(),
                                main_schedule_id: mainScheduleInserted[mIndex].main_schedule_id,
                                kanban_id: subScheduleBulkSchema[subIndex].kanban_id,
                                zone_id: subScheduleBulkSchema[subIndex].zone_id,
                                freq_id: subScheduleBulkSchema[subIndex].freq_id,
                                schedule_id: subScheduleBulkSchema[subIndex].schedule_id,
                                shift_type: subScheduleBulkSchema[subIndex].shift_type,
                                plan_time: subScheduleBulkSchema[subIndex].plan_time,
                                is_holiday: subScheduleBulkSchema[subIndex].is_holiday,
                            })
                        }
                    }
                }
                //#endregion

                //#region scheduler combine all sign checker schema
                if (signCheckerTl1BulkSchema.length > 0)
                {
                    for (let tl1Index = 0; tl1Index < signCheckerTl1BulkSchema.length; tl1Index++)
                    {
                        if (
                            signCheckerTl1BulkSchema[tl1Index].group_id == mainScheduleInserted[mIndex].group_id
                            && signCheckerTl1BulkSchema[tl1Index].line_id == mainScheduleInserted[mIndex].line_id
                        )
                        {
                            signCheckersTemp.push({
                                main_schedule_id: mainScheduleInserted[mIndex].main_schedule_id,
                                uuid: uuid(),
                                start_date: signCheckerTl1BulkSchema[tl1Index].start_date,
                                end_date: signCheckerTl1BulkSchema[tl1Index].end_date,
                                is_tl_1: true,
                                is_tl_2: null,
                                is_gl: null,
                                is_sh: null,
                            })
                        }
                    }
                }

                if (signCheckerTl2BulkSchema.length > 0)
                {
                    for (let tl2Index = 0; tl2Index < signCheckerTl2BulkSchema.length; tl2Index++)
                    {
                        if (
                            signCheckerTl2BulkSchema[tl2Index].group_id == mainScheduleInserted[mIndex].group_id
                            && signCheckerTl2BulkSchema[tl2Index].line_id == mainScheduleInserted[mIndex].line_id
                        )
                        {
                            signCheckersTemp.push({
                                main_schedule_id: mainScheduleInserted[mIndex].main_schedule_id,
                                uuid: uuid(),
                                start_date: signCheckerTl2BulkSchema[tl2Index].start_date,
                                end_date: signCheckerTl2BulkSchema[tl2Index].end_date,
                                is_tl_1: null,
                                is_tl_2: true,
                                is_gl: null,
                                is_sh: null,
                            })
                        }
                    }
                }

                if (signChckerGlBulkSchema.length > 0)
                {
                    for (let glIndex = 0; glIndex < signChckerGlBulkSchema.length; glIndex++)
                    {
                        if (
                            signChckerGlBulkSchema[glIndex].group_id == mainScheduleInserted[mIndex].group_id
                            && signChckerGlBulkSchema[glIndex].line_id == mainScheduleInserted[mIndex].line_id
                        )
                        {
                            signCheckersTemp.push({
                                main_schedule_id: mainScheduleInserted[mIndex].main_schedule_id,
                                uuid: uuid(),
                                start_date: signChckerGlBulkSchema[glIndex].start_date,
                                end_date: signChckerGlBulkSchema[glIndex].end_date,
                                is_tl_1: null,
                                is_tl_2: null,
                                is_gl: true,
                                is_sh: null,
                            })
                        }
                    }
                }

                if (signChckerShBulkSchema.length > 0)
                {
                    for (let shIndex = 0; shIndex < signChckerShBulkSchema.length; shIndex++)
                    {
                        if (
                            signChckerShBulkSchema[shIndex].group_id == mainScheduleInserted[mIndex].group_id
                            && signChckerShBulkSchema[shIndex].line_id == mainScheduleInserted[mIndex].line_id
                        )
                        {
                            signCheckersTemp.push({
                                main_schedule_id: mainScheduleInserted[mIndex].main_schedule_id,
                                uuid: uuid(),
                                start_date: signChckerShBulkSchema[shIndex].start_date,
                                end_date: signChckerShBulkSchema[shIndex].end_date,
                                //end_date: `func (select "date" from tb_m_schedules where "date" between '${signChckerShBulkSchema[shIndex].start_date}' and '${signChckerShBulkSchema[shIndex].end_date}' and (is_holiday is null or is_holiday = false) order by schedule_id desc limit 1)`,
                                is_tl_1: null,
                                is_tl_2: null,
                                is_gl: null,
                                is_sh: true,
                            })
                        }
                    }
                }
                //#endregion
            }

            //#region scheduler inserted tb_r_4s_sub_schedules

            if (subScheduleTemp.length > 0)
            {
                const sSchema = await bulkToSchema(subScheduleTemp)
                const sqlInSub = `insert into ${table.tb_r_4s_sub_schedules} (${sSchema.columns}) values ${sSchema.values}`
                //console.log('sqlInSub', sqlInSub);
                await db.query(sqlInSub)
                console.log('tb_r_4s_sub_schedules', 'inserted')
            }
            else
            {
                console.log('tb_r_4s_sub_schedules', 'skipped!')
            }

            //#endregion

            //#region scheduler inserted tb_r_4s_schedule_sign_checkers
            if (signCheckersTemp.length > 0)
            {
                const sgSchema = await bulkToSchema(signCheckersTemp)
                const sqlInSign = `insert into ${table.tb_r_4s_schedule_sign_checkers} (${sgSchema.columns}) values ${sgSchema.values}`
                //console.log('sqlInSign', sqlInSign);
                await db.query(sqlInSign)
                console.log('tb_r_4s_schedule_sign_checkers', 'inserted')
            }
            else
            {
                console.log('tb_r_4s_schedule_sign_checkers', 'skipped!')
            }

            //#endregion
        })
        //#endregion

        return transaction
    } catch (error)
    {
        console.log('error 4s generate schedule, scheduler running', error)
        throw error
    }
}
//#endregion

const test = async () => {
    const shiftRows = await shiftByGroupId()
    //const signCheckers = await genSignCheckers(shiftRows)
    //const signChckerGlBulkSchema = signCheckers.gl
    //const signChckerShBulkSchema = signCheckers.sh

    //logger(signChckerShBulkSchema.splice(0, 6), '', 'info', true)
}

/* test()
    .then((r) => {
        return 0
    })
    .catch((e) => {
        console.error('test error', e)
        return 0
    }) */

/* clear4sRows()
    .then((r) => 0)
    .catch((e) => 0) */

/* clear4sRows()
    .then((r) => {
        main()
            .then((r) => {
                logger(`success run scheduler for month=${currentMonth}-${currentYear}`)
                return 0
            })
            .catch((e) => {
                logger(`error clear4sRows() 4s.scheduler for month=${currentMonth}-${currentYear}`, {
                    data: e
                })
                return 0
            })
    })
    .catch((e) => {
        logger(`error clear4sRows() 4s.scheduler for month=${currentMonth}-${currentYear}`, {
            data: e
        })
        return 0
    }) */

main()
    .then((result) => {
        process.exit()
    })
    .catch((error) => {
        process.exit()
    })

//module.exports = main