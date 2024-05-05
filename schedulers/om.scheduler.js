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

//date_part('week', '${currentMonthDay.date}':: date)
const dateFormatted = (date = '') => (moment(date, 'YYYY-MM-DD').format('YYYY-MM-DD'))

//#region scheduler delete all for testing purpose
const clearOmRows = async () => {
    if (process.env.NODE_ENV.trim() == 'dev' || process.env.NODE_ENV.trim() == 'local')
    {
        console.log('clearing start')
        await databasePool.query(`SET session_replication_role = 'replica'`)

        await databasePool.query(`DELETE FROM ${table.tb_r_om_main_schedules} CASCADE`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_om_main_schedules} ALTER COLUMN om_main_schedule_id RESTART WITH 1`)

        await databasePool.query(`DELETE FROM ${table.tb_r_om_sub_schedules} CASCADE`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_om_sub_schedules} ALTER COLUMN om_sub_schedule_id RESTART WITH 1`)

        await databasePool.query(`DELETE FROM ${table.tb_r_om_schedule_sign_checkers} CASCADE`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_om_schedule_sign_checkers} ALTER COLUMN om_sign_checker_id RESTART WITH 1`)

        await databasePool.query(`SET session_replication_role = 'origin'`)
        console.log('clearing succeed')
    }
}
//#endregion

//#region scheduler line, group schedule month
/**
 * 
 * @returns {Promise<pg.QueryResultRow>}
 */
const lineGroupRows = async (onlySql = false) => {
    const lineGroupQuery =
        `
                select 
                    tml.line_id,
                    tmg.group_id,
                    tmsm.month_num
                from 
                    (select * from tb_m_lines order by line_id asc) tml,
                    (select * from tb_m_groups where is_active = true) tmg,
                    (select date_part('month', date) as month_num from tb_m_schedules where date_part('month', date) = '${currentMonth}' and date_part('year', date) = ${currentYear} group by month_num) tmsm
            `
    if (onlySql)
    {
        return lineGroupQuery
    }

    const lgQuery = await databasePool.query(lineGroupQuery)
    return lgQuery.rows
}
//#endregion

//#region scheduler shift by group id
/**
 * 
 * @returns {Promise<Array<any>>}
 */
const shiftByGroupId = async () => {
    //#region scheduler shiftSql
    const shiftSql =
        `
            with
                shifts as (
                            select distinct on
                                ( tms1.date )
                                tms1.schedule_id,
                                tms1.date,
                                date_part('week', date::date) as week_num,
                                tms1.is_holiday as is_holiday_schedule,
                                shift_holiday.is_holiday or tms1.is_holiday as is_holiday
                            from
                                tb_m_schedules tms1
                                    left join tb_m_shifts shift_holiday on
                                        tms1.date between shift_holiday.start_date and shift_holiday.end_date
                                        and shift_holiday.is_holiday = true
                            where
                                    date_part('month', tms1.date) = ${currentMonth}
                                and date_part('year', tms1.date) = ${currentYear}
                            order by
                                date
                        ),
                schedules as (
                                select distinct on (shifts.date)
                                    shifts.schedule_id,
                                    shifts.week_num,
                                    shifts.date,
                                    to_char(shifts.date::date, 'dd') as date_num,
                                    shifts.is_holiday,
                                    shifts.is_holiday_schedule,
                                    ceiling(
                                                (
                                                        date_part(
                                                                'day', shifts.date) - date_part(
                                                                'dow', shifts.date)) / 7) =
                                    1                                as is_first_week
                                from
                                    shifts
                                order by
                                    shifts.date
                            )
            select
                        row_number()
                        over (ORDER BY schedules.date )::integer as no,
                        schedules.*
            from
                schedules
            order by
                schedules.date
        `
    //#endregion    

    //console.log('shiftSql', shiftSql)
    //logger(shiftSql)
    const shiftQuery = await databasePool.query(shiftSql)
    return shiftQuery.rows
}
//#endregion

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

//#region scheduler generate sub schedule schema
/**
 * @typedef {Object} subScheduleBulkSchema
 * @param {pg.QueryResultRow} shiftRows 
 * @returns {Promise<Array<subScheduleBulkSchema>>} []
 */
const genSubSchedule = async (lineGroup, shiftRows = []) => {
    const result = []

    //#region scheduler fetch all item check
    const itemCheckQuery = await databasePool.query(
        `
            select
                tmoick.om_item_check_kanban_id,
                tmf.freq_id,
                tmm.machine_id,
                tmf.precition_val
            from
                ${table.tb_m_om_item_check_kanbans} tmoick
                    join ${table.tb_m_machines} tmm on tmoick.machine_id = tmm.machine_id
                    join ${table.tb_m_freqs} tmf on tmoick.freq_id = tmf.freq_id
            where
                tmm.line_id = ${lineGroup.line_id}
                and tmoick.group_id = ${lineGroup.group_id}
            order by
                tmf.precition_val
        `)
    const itemCheckRows = itemCheckQuery.rows
    if (itemCheckRows.length == 0)
    {
        return result
    }
    //#endregion

    {
        let countSame = 0 // determine steps pattern
        let lastWeekNum = 0
        for (let kIndex = 0; kIndex < itemCheckRows.length; kIndex++)
        {
            let planTime = null
            let shouldPlan = false

            // >= 1 MONTH 
            if (itemCheckRows[kIndex].precition_val >= 30)
            {
                const lastPlanTimeQuery = await databasePool.query(
                    `
                        select
                            tms.date
                        from
                            tb_r_om_sub_schedules tross
                                join tb_m_om_item_check_kanbans tmoick on tross.om_item_check_kanban_id = tmoick.om_item_check_kanban_id
                                join tb_m_machines tmm on tross.machine_id = tmm.machine_id
                                join tb_m_freqs tmf on tross.freq_id = tmf.freq_id
                                join tb_m_schedules tms on tross.schedule_id = tms.schedule_id
                        where 
                            tross.om_item_check_kanban_id = '${itemCheckRows[kIndex].om_item_check_kanban_id}'
                            and tross.machine_id = '${itemCheckRows[kIndex].machine_id}'
                            and tross.freq_id = '${itemCheckRows[kIndex].freq_id}'
                            and tms.date = '${currentYear}-${currentMonth}-01'::date - interval '${itemCheckRows[kIndex].precition_val} days'
                        limit 1
                    `
                )

                if (lastPlanTimeQuery.rows && lastPlanTimeQuery.rowCount > 0)
                {
                    planTime = moment(lastPlanTimeQuery.rows[0].date, 'YYYY-MM-DD')
                        .add(itemCheckRows[kIndex].precition_val, 'd')
                        .format('YYYY-MM-DD')

                    //MONTHLY should plan on holiday  
                    if (
                        itemCheckRows[kIndex].precition_val == 30
                        && moment(planTime).day() != 6
                    )
                    {
                        console.log('platime before', planTime)
                        planTime = moment(planTime)
                            .clone()
                            .weekday(6)
                            .format('YYYY-MM-DD')
                        console.log('platime after', planTime)
                    }
                    //2 MONTH should plan on week day
                    else if (moment(planTime).day() == 6 || moment(planTime).day() == 7)
                    {
                        planTime = moment(planTime)
                            .clone()
                            .weekday(1 + countSame)
                            .format('YYYY-MM-DD')
                    }
                }
                else
                {
                    //#region check validaty of item check precition_val should plan if not already exists 
                    const scheduleExists = await databasePool.query(
                        `
                            select 
                                count(*) as count
                            from 
                                ${table.tb_r_om_sub_schedules}  
                            where 
                                om_item_check_kanban_id = '${itemCheckRows[kIndex].om_item_check_kanban_id}'
                                and machine_id = '${itemCheckRows[kIndex].machine_id}'
                                and freq_id = '${itemCheckRows[kIndex].freq_id}'
                        `
                    )
                    if (scheduleExists.rows && scheduleExists.rows.length > 0 && scheduleExists.rows[0].count > 0)
                    {
                        continue
                    }
                    //#endregion

                    if (
                        itemCheckRows[kIndex].precition_val == 30
                    )
                    {
                        countSame = 6 // saturday was 6 index of 7 days
                    }
                    else
                    {
                        countSame = 2
                    }

                    //console.log('shouldplan', itemCheckRows[kIndex].freq_id);
                    shouldPlan = true
                }
            }
            else
            {
                shouldPlan = true
            }

            //#region scheduler generate daily 
            if (itemCheckRows[kIndex].precition_val == 1)
            {
                for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
                {
                    if (!shiftRows[sIndex].is_holiday)
                    {
                        planTime = dateFormatted(shiftRows[sIndex].date)
                    }
                    else
                    {
                        shouldPlan = false
                        planTime = null
                    }

                    const exists = result.find((item) =>
                        item.group_id == lineGroup.group_id
                        && item.line_id == lineGroup.line_id
                        && item.om_item_check_kanban_id == shiftRows[sIndex].om_item_check_kanban_id
                        && item.machine_id == shiftRows[sIndex].machine_id
                        && item.freq_id == shiftRows[sIndex].freq_id
                        && item.schedule_id == shiftRows[sIndex].schedule_id
                    )

                    if (exists)
                    {
                        continue
                    }

                    result.push({
                        main_schedule_id: null,
                        group_id: lineGroup.group_id,
                        line_id: lineGroup.line_id,
                        om_item_check_kanban_id: itemCheckRows[kIndex].om_item_check_kanban_id,
                        machine_id: itemCheckRows[kIndex].machine_id,
                        freq_id: itemCheckRows[kIndex].freq_id,
                        schedule_id: shiftRows[sIndex].schedule_id,
                        plan_time: planTime == dateFormatted(shiftRows[sIndex].date) ? planTime : null, // validate if date plan is equal the date loop
                        is_holiday: shiftRows[sIndex].is_holiday,
                    })
                }
            }
            //#endregion
            //#region scheduler generate 1 week, 1 month etc
            else
            {
                let planTimeWeeklyArr = []
                if (shouldPlan && itemCheckRows[kIndex].precition_val == 7)
                {
                    // determine plan time should only has precition_val * 
                    if (countSame > 5)
                    {
                        countSame = 5
                    }
                    if (countSame > 5)
                    {
                        countSame--
                    }
                    if (countSame < 1)
                    {
                        countSame = 1
                    }

                    for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
                    {
                        if (countSame == 0)
                        {
                            countSame++
                        }

                        if (
                            lastWeekNum != shiftRows[sIndex].week_num
                            && !shiftRows[sIndex].is_holiday
                        )
                        {
                            /* const byDowSql =
                                `
                                            select 
                                                tmsc.date,
                                                non_holiday.day_of_week
                                            from (
                                                select
                                                    tms1."date",
                                                    EXTRACT('DOW' FROM tms1."date"::timestamp) AS day_of_week
                                                from
                                                    ${table.tb_m_schedules} tms1
                                                    left join tb_m_shifts shift_holiday on
                                                        tms1.date between shift_holiday.start_date and shift_holiday.end_date
                                                        and shift_holiday.is_holiday = true
                                                where
                                                    (tms1.is_holiday is null or tms1.is_holiday = false)
                                                    and (shift_holiday.is_holiday is null or shift_holiday.is_holiday = false)
                                            ) non_holiday 
                                            join ${table.tb_m_schedules} tmsc on non_holiday.date = tmsc.date 
                                            where  
                                                date_part('week', tmsc."date") = '${shiftRows[sIndex].week_num}'
                                                and date_part('month', tmsc."date") = ${currentMonth}
                                            order by 
                                                tmsc.date
                                            limit 1
                                        `

                            const byDow = (await databasePool.query(byDowSql)).rows
                            let added = false
                            for (let dIndex = 0; dIndex < byDow.length; dIndex++)
                            {
                                if (byDow[dIndex].day_of_week == countSame)
                                {
                                    added = true
                                    planTimeWeeklyArr.push(dateFormatted(byDow[dIndex].date))
                                    break;
                                }
                            }

                            if (!added)
                            {
                                const randomDow = byDow[getRandomInt(0, byDow.length - 1)]
                                planTimeWeeklyArr.push(dateFormatted(randomDow.date))
                                countSame = randomDow.day_of_week
                            } */
                            const nonHolidayWeekEnds = shiftRows.filter((item) => !item.is_holiday && shiftRows[sIndex].week_num == item.week_num);
                            planTimeWeeklyArr.push(dateFormatted(nonHolidayWeekEnds[getRandomInt(0, nonHolidayWeekEnds.length - 1)].date))
                            lastWeekNum = shiftRows[sIndex].week_num
                        }

                        if (lastWeekNum == 0)
                        {
                            lastWeekNum = shiftRows[sIndex].week_num
                        }
                    }

                    countSame++
                }

                if (itemCheckRows[kIndex].precition_val == 30)
                {
                    const holidayWeekEnds = shiftRows.filter((item) => item.is_holiday_schedule);
                    planTime = holidayWeekEnds[getRandomInt(0, holidayWeekEnds.length - 1)].date;
                }

                for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
                {
                    if (itemCheckRows[kIndex].precition_val == 7)
                    {
                        planTime = planTimeWeeklyArr.find((item) => item == dateFormatted(shiftRows[sIndex].date))
                    }

                    if (!planTime && itemCheckRows[kIndex].precition_val != 7)
                    {
                        planTime = moment(`${currentYear}-${padTwoDigits(currentMonth)}-${padTwoDigits(getRandomInt(1, 30))}`)
                            .clone()
                            .format('YYYY-MM-DD')

                        if (
                            itemCheckRows[kIndex].precition_val == 30
                            && moment(planTime).day() != 6
                        )
                        {
                            planTime = moment(planTime)
                                .clone()
                                .weekday(6)
                                .format('YYYY-MM-DD')
                        }
                    }

                    const exists = result.find((item) =>
                        item.line_id == lineGroup.line_id
                        && item.group_id == lineGroup.group_id
                        && item.om_item_check_kanban_id == shiftRows[sIndex].om_item_check_kanban_id
                        && item.machine_id == shiftRows[sIndex].machine_id
                        && item.freq_id == shiftRows[sIndex].freq_id
                        && item.schedule_id == shiftRows[sIndex].schedule_id
                    )
                    if (exists)
                    {
                        continue
                    }

                    result.push({
                        main_schedule_id: null,
                        group_id: lineGroup.group_id,
                        line_id: lineGroup.line_id,
                        om_item_check_kanban_id: itemCheckRows[kIndex].om_item_check_kanban_id,
                        machine_id: itemCheckRows[kIndex].machine_id,
                        freq_id: itemCheckRows[kIndex].freq_id,
                        schedule_id: shiftRows[sIndex].schedule_id,
                        plan_time: planTime == dateFormatted(shiftRows[sIndex].date) ? planTime : null, // validate if date plan is equal the date loop
                        is_holiday: shiftRows[sIndex].is_holiday,
                    })
                }
            }
            //#endregion
        }

        //console.log('subScheduleBulkSchema', subScheduleBulkSchema.length)
    }

    return result
}
//#endregion

//#region scheduler generate sign checkers
/**
 * 
 * @param {pg.QueryResultRow} shiftRows 
 */
const genSignCheckers = async (lineGroup, shiftRows = []) => {
    const result = {
        tl: [],
        gl: [],
    }

    //#region scheduler generate tl1 & tl2 sign checker
    {
        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {
            if (!shiftRows[sIndex].is_holiday)
            {
                result.tl.push({
                    main_schedule_id: null,
                    group_id: lineGroup.group_id,
                    line_id: lineGroup.line_id,
                    is_tl: true,
                    start_date: moment(shiftRows[sIndex].date, 'YYYY-MM-DD').format('YYYY-MM-DD'),
                    end_date: moment(shiftRows[sIndex].date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                })
            }
        }

        //console.log('signCheckerTl1BulkSchema', signCheckerTl1BulkSchema)
        //console.log('signCheckerTl2BulkSchema', signCheckerTl2BulkSchema)
    }
    //#endregion

    //#region scheduler generate gl sign checker
    {
        try
        {
            const glSignSql = `
                    with
                        week as (
                            select
                                date_part('week', "date"::date) as week_num,
                                count(distinct "date")::integer as col_span
                            from
                                ${table.tb_m_schedules}
                            where
                                date_part('month', "date") = '${currentMonth}'
                                and date_part('year', "date") = '${currentYear}'
                                and (is_holiday is null or is_holiday = false)
                            group by
                                week_num
                            order by
                                week_num
                        )
                        select
                            res.week_num,
                            res.col_span,
                            started.start_non_holiday,
							ended.end_non_holiday
                        from (
                            select
                                week.week_num,
                                week.col_span,
                                min("date") as start,
                                max("date") as end
                            from 
                                ${table.tb_m_schedules} tms
                                join week on date_part('week', tms."date"::date) = week.week_num
                            group by
                                week.week_num, week.col_span
                            order by week.week_num
                        ) res
                        left join lateral (
                            select count(*) as total_holiday from ${table.tb_m_schedules} where is_holiday = true and "date" between res.start and res.end 
                        ) hol on true
                        left join lateral (
                            select 
                                date as start_non_holiday
                            from 
                                ${table.tb_m_schedules}
                            where 
                                date_part('week', "date"::date) = res.week_num
                                and (is_holiday = false or is_holiday is null)
                            order by
                                date asc
                            limit 1
                        ) started on true
                        left join lateral (
                            select
                                date as end_non_holiday
                            from
                                ${table.tb_m_schedules}
                            where 
                                date_part('week', "date"::date) = res.week_num
                                and (is_holiday = false or is_holiday is null)
                                and date_part('month', "date") = '${currentMonth}'
                                and date_part('year', "date") = '${currentYear}'
                            order by
                                date desc
                            limit 1
                        ) ended on true
                `

            //console.log('glSignSql', glSignSql)
            //logger(glSignSql)
            const glSignQuery = await databasePool.query(glSignSql)

            for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
            {
                const exists = result.gl.find((g) => g.group_id == lineGroup.group_id && g.line_id == lineGroup.line_id)
                if (exists)
                {
                    continue
                }

                for (let glIndex = 0; glIndex < glSignQuery.rows.length; glIndex++)
                {
                    result.gl.push({
                        main_schedule_id: null,
                        group_id: lineGroup.group_id,
                        line_id: lineGroup.line_id,
                        start_date: dateFormatted(glSignQuery.rows[glIndex].start_non_holiday),
                        end_date: dateFormatted(glSignQuery.rows[glIndex].end_non_holiday),
                        col_span: glSignQuery.rows[glIndex].col_span,
                        is_gl: true,
                    })
                }
            }
            //console.log('result.gl', result.gl)
        } catch (error)
        {
            console.log('error glSignQuery', error)
            throw error
        }
    }
    //#endregion

    return result
}
//#endregion

//#region scheduler main 
const main = async () => {
    try
    {
        //await clearOmRows();

        //#region schedulers parent 
        const lineGroups = await lineGroupRows()
        const shiftRows = await shiftByGroupId()
        const mainScheduleBulkSchema = []
        const subScheduleBulkSchema = []
        const signCheckerTl1BulkSchema = []
        const signChckerGlBulkSchema = []

        for (let lgIndex = 0; lgIndex < lineGroups.length; lgIndex++)
        {
            //#region scheduler bulk temp var
            const mainScheduleBulk = await genMainSchedule(lineGroups[lgIndex])
            const subScheduleBulk = await genSubSchedule(lineGroups[lgIndex], shiftRows)
            const signCheckers = await genSignCheckers(lineGroups[lgIndex], shiftRows)

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
    //await clearOmRows()
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

/* clearOmRows()
    .then((r) => 0)
    .catch((e) => 0) */

clearOmRows()
    .then((r) => {
        main()
            .then((r) => {
                logger(`success run scheduler for month=${currentMonth}-${currentYear}`)
                return 0
            })
            .catch((e) => {
                logger(`error clearOmRows() om.scheduler for month=${currentMonth}-${currentYear}`, {
                    data: e
                })
                return 0
            })
    })
    .catch((e) => {
        logger(`error clearOmRows() om.scheduler for month=${currentMonth}-${currentYear}`, {
            data: e
        })
        return 0
    })

/* main()
    .then((result) => {
        process.exit()
    })
    .catch((error) => {
        process.exit()
    }) */