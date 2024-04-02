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
const currentMonth = currentDate.month() + 1 // need +1 to determine current month
const currentYear = currentDate.year()

//date_part('week', '${currentMonthDay.date}':: date)
const dateFormatted = (date = '') => (moment(date, 'YYYY-MM-DD').format('YYYY-MM-DD'))

//#region scheduler generateSchedules
/**
 * 
 * @param {databasePool} db 
 * @returns 
 */
const generateSchedules = async (db) => {
    const currentMonthHoldayResp = await holidayRequest(currentYear, currentMonth)
    const currentMonthDays = generateMonthlyDates(currentYear, currentMonth)

    const currentMonthHolidayData = currentMonthHoldayResp.data
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

        currentMonthDay.uuid = uuid()
        result.push(currentMonthDay)
    }

    const scheduleSchema = await bulkToSchema(result)
    //console.log('result', scheduleSchema)
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

        await databasePool.query(`DELETE FROM ${table.tb_r_4s_main_schedules} CASCADE`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_4s_main_schedules} ALTER COLUMN main_schedule_id RESTART WITH 1`)

        await databasePool.query(`DELETE FROM ${table.tb_r_4s_sub_schedules} CASCADE`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_4s_sub_schedules} ALTER COLUMN sub_schedule_id RESTART WITH 1`)

        await databasePool.query(`DELETE FROM ${table.tb_r_4s_schedule_sign_checkers} CASCADE`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_4s_schedule_sign_checkers} ALTER COLUMN sign_checker_id RESTART WITH 1`)

        await databasePool.query(`SET session_replication_role = 'origin'`)
        console.log('clearing succeed')
    }
}
//#endregion

//#region scheduler added group to mainSchedule
/**
 * @typedef {Object} mainScheduleBulkSchema
 * @returns {Promise<Array<mainScheduleBulkSchema>>}
 */
const genMainSchedule = async () => {
    const result = []

    /* const groupQuery = await databasePool.query(`select * from ${table.tb_m_groups} where group_nm in ('WHITE', 'RED')`)
        groupQuery.rows.forEach((group, gIndex) => {
            
        }) */
    //const lineQuery = await databasePool.query(`select * from ${table.tb_m_lines} order by line_id asc limit 6`)
    const lgQuery = await databasePool.query(`
                select 
                    tml.line_id,
                    tmg.group_id
                    ,tmsm.month_num
                from 
                    (select * from tb_m_lines order by line_id asc limit 1) tml,
                    (select * from tb_m_groups where group_nm in ('WHITE', 'RED')) tmg,
                    (select date_part('month', date) as month_num from tb_m_schedules group by month_num) tmsm
            `)

    for (let lnIndex = 0; lnIndex < lgQuery.rows.length; lnIndex++)
    {
        result.push({
            uuid: uuid(),
            month_num: lgQuery.rows[lnIndex].month_num,
            year_num: currentYear,
            line_id: lgQuery.rows[lnIndex].line_id,
            group_id: lgQuery.rows[lnIndex].group_id,
        })
    }

    //console.log('mainschedule', mainScheduleBulkSchema)

    return result
}
//#endregion

//#region scheduler generate sub schedule schema
/**
 * @typedef {Object} subScheduleBulkSchema
 * @param {pg.QueryResultRow} shiftRows 
 * @returns {Promise<Array<subScheduleBulkSchema>>} []
 */
const genSubSchedule = async (shiftRows = []) => {
    const result = []

    //#region scheduler fetch all kanban
    const kanbanQuery = await databasePool.query(`
                select
                    tmk.kanban_id,
                    tmz.zone_id,
                    tmf.freq_id,
                    tmf.freq_nm,
                    tmz.zone_nm,
                    tmk.kanban_no,
                    tmk.area_nm,
                    tmf.precition_val
                from
                    ${table.tb_m_kanbans} tmk
                    join ${table.tb_m_zones} tmz on tmk.zone_id = tmz.zone_id
                    join ${table.tb_m_freqs} tmf on tmf.freq_id = tmk.freq_id
            `)
    const kanbanRows = kanbanQuery.rows
    //#endregion

    {
        let countSame = 0 // determine steps pattern
        let skip = false
        let lastWeekNum = 0
        for (let kIndex = 0; kIndex < kanbanRows.length; kIndex++)
        {
            let planTime = null
            let shouldPlan = false

            // determine plan time should only has precition_val * 
            if (
                kanbanRows[kIndex - 1]
                && kanbanRows[kIndex - 1].freq_id == kanbanRows[kIndex].freq_id
            )
            {
                countSame++
                skip = false
                if (countSame > 5)
                {
                    countSame = 1
                }
            }
            else
            {
                countSame = 0
            }

            // WEEKLY, MONTHLY, 2 MONTH .....
            if (kanbanRows[kIndex].precition_val >= 30)
            {
                const lastPlanTimeQuery = await databasePool.query(`
                                    select
                                        tms."date"
                                    from
                                        ${table.tb_r_4s_sub_schedules} trss
                                        join ${table.tb_m_kanbans} tmk on trss.kanban_id = tmk.kanban_id
                                        join ${table.tb_m_zones} tmz on trss.zone_id = tmz.zone_id
                                        join ${table.tb_m_freqs} tmf on trss.freq_id = tmf.freq_id
                                        join ${table.tb_m_schedules} tms on trss.schedule_id = tms.schedule_id
                                    where 
                                        trss.kanban_id = '${kanbanRows[kIndex].kanban_id}'
                                        and trss.zone_id = '${kanbanRows[kIndex].zone_id}'
                                        and trss.freq_id = '${kanbanRows[kIndex].freq_id}'
                                    order by
                                        trss.sub_schedule_id desc limit 1
                                    `
                )

                if (lastPlanTimeQuery.rows && lastPlanTimeQuery.rowCount > 0)
                {
                    //console.log('lastPlanTimeQuery.rows[0]', lastPlanTimeQuery.rows[0])
                    planTime = moment(lastPlanTimeQuery.rows[0].date, 'YYYY-MM-DD')
                        .add(kanbanRows[kIndex].precition_val, 'd')
                        .format('YYYY-MM-DD')

                    //MONTHLY should plan on holiday  
                    if (
                        kanbanRows[kIndex].freq_nm
                        && kanbanRows[kIndex].freq_nm.toLowerCase() == 'monthly'
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
                    shouldPlan = true
                    if (
                        kanbanRows[kIndex].freq_nm
                        && kanbanRows[kIndex].freq_nm.toLowerCase() == 'monthly'
                    )
                    {
                        countSame = 6 // saturday was 6 index of 7 days
                    }
                    else
                    {
                        countSame = 2
                    }

                }
            }
            else
            {
                shouldPlan = true
            }

            //#region scheduler generate daily 
            if (kanbanRows[kIndex].freq_nm.toLowerCase() == 'daily')
            {
                for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
                {
                    if (shiftRows[sIndex].shift_type == 'morning_shift')
                    {
                        // DAILY 
                        if (!shiftRows[sIndex].is_holiday && kanbanRows[kIndex].precition_val == 1)
                        {
                            planTime = dateFormatted(shiftRows[sIndex].date)
                        }
                    }
                    else
                    {
                        shouldPlan = false
                        planTime = null
                    }

                    if (
                        !shouldPlan
                        && shiftRows[sIndex + 1]
                        && shiftRows[sIndex + 1].shift_type == 'morning_shift'
                    )
                    {
                        shouldPlan = true
                    }

                    result.push({
                        main_schedule_id: null,
                        kanban_id: kanbanRows[kIndex].kanban_id,
                        zone_id: kanbanRows[kIndex].zone_id,
                        freq_id: kanbanRows[kIndex].freq_id,
                        schedule_id: shiftRows[sIndex].schedule_id,
                        shift_type: shiftRows[sIndex].shift_type,
                        plan_time: planTime == dateFormatted(shiftRows[sIndex].date) ? planTime : null, // validate if date plan is equal the date loop
                    })
                }
            }
            //#endregion
            //#region scheduler generate weekly, monthly etc
            else
            {
                let planTimeWeeklyArr = []
                if (shouldPlan)
                {
                    for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
                    {
                        if (shiftRows[sIndex].shift_type == 'morning_shift')
                        {
                            if (kanbanRows[kIndex].freq_nm.toLowerCase() == 'weekly')
                            {
                                if (countSame == 0)
                                {
                                    countSame++
                                }

                                if (
                                    shiftRows[sIndex].total_day_of_week > 1
                                    && lastWeekNum != shiftRows[sIndex].week_num
                                )
                                {
                                    const byDowSql = `
                                            select 
                                                tmsc.date 
                                            from (
                                                select
                                                    "date",
                                                    EXTRACT('DOW' FROM "date"::timestamp) AS day_of_week
                                                from
                                                    ${table.tb_m_schedules}
                                                where
                                                    is_holiday is null or is_holiday = false
                                            ) non_holiday 
                                            join ${table.tb_m_schedules} tmsc on non_holiday.date = tmsc.date 
                                            where  
                                                non_holiday.day_of_week = '${countSame}'
                                                and date_part('week', tmsc."date") = '${shiftRows[sIndex].week_num}'
                                            order by 
                                                tmsc.date
                                            limit 1
                                        `

                                    const byDow = await databasePool.query(byDowSql)
                                    planTimeWeeklyArr.push(dateFormatted(byDow.rows[0].date))
                                    lastWeekNum = shiftRows[sIndex].week_num

                                    skip = true
                                }

                                if (lastWeekNum == 0)
                                {
                                    lastWeekNum = shiftRows[sIndex].week_num
                                }
                            }
                            else if (
                                shiftRows[sIndex].is_first_week
                                && (kanbanRows[kIndex].freq_nm.toLowerCase() == 'monthly'
                                    || kanbanRows[kIndex].freq_nm.toLowerCase() == '2 month'
                                    || kanbanRows[kIndex].freq_nm.toLowerCase() == '3 month')
                            )
                            {
                                planTime = moment(shiftRows[sIndex].date)
                                    .clone()
                                    .weekday(countSame)
                                    .format('YYYY-MM-DD')

                                /*  console.log('plantime monthly', {
                                     planTime: planTime,
                                     countSame: countSame
                                 }) */

                                break;
                            }
                        }
                    }
                }

                for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
                {
                    if (kanbanRows[kIndex].freq_nm.toLowerCase() == 'weekly')
                    {
                        planTime = planTimeWeeklyArr.find((item) => item == dateFormatted(shiftRows[sIndex].date))
                    }

                    result.push({
                        main_schedule_id: null,
                        kanban_id: kanbanRows[kIndex].kanban_id,
                        zone_id: kanbanRows[kIndex].zone_id,
                        freq_id: kanbanRows[kIndex].freq_id,
                        schedule_id: shiftRows[sIndex].schedule_id,
                        shift_type: shiftRows[sIndex].shift_type,
                        plan_time: planTime == dateFormatted(shiftRows[sIndex].date) ? planTime : null, // validate if date plan is equal the date loop
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
 * @returns {Promise<Array<any>>} result
 */
const genSignCheckers = async (shiftRows = []) => {
    const result = {
        tl1: [],
        tl2: [],
        gl: [],
        sh: []
    }

    //#region scheduler generate tl1 & tl2 sign checker
    {
        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {
            if (!shiftRows[sIndex].is_holiday)
            {
                result.tl1.push({
                    main_schedule_id: null,
                    is_tl_1: true,
                    start_date: moment(shiftRows[sIndex].date, 'YYYY-MM-DD').format('YYYY-MM-DD'),
                    end_date: moment(shiftRows[sIndex].date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                })

                result.tl2.push({
                    main_schedule_id: null,
                    is_tl_2: true,
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
                            order by
                                date desc
                            limit 1
                        ) ended on true
                `

            //console.log('glSignSql', glSignSql)
            const glSignQuery = await databasePool.query(glSignSql)

            for (let glIndex = 0; glIndex < glSignQuery.rows.length; glIndex++)
            {
                result.gl.push({
                    main_schedule_id: null,
                    start_date: dateFormatted(glSignQuery.rows[glIndex].start_non_holiday),
                    end_date: dateFormatted(glSignQuery.rows[glIndex].end_non_holiday),
                    col_span: glSignQuery.rows[glIndex].col_span,
                    is_gl: true,
                })
            }

            //console.log('signChckerGlBulkSchema', signChckerGlBulkSchema)
        } catch (error)
        {
            console.log('error glSignQuery', error)
            throw error
        }
    }
    //#endregion

    //#region scheduler generate sh sign checker
    {
        let tempSh = []
        result.gl.forEach((gl) => tempSh.push(Object.assign({}, gl)))

        for (var i = 0; i < tempSh.length; ++i)
        {
            if (tempSh[i].col_span > 1)
            {
                for (var j = i + 1; j < tempSh.length; ++j)
                {
                    tempSh[i].col_span = tempSh[i].col_span + tempSh[j].col_span
                    tempSh[i].start_date = moment(tempSh[i].start_date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                    tempSh[i].end_date = moment(tempSh[j].end_date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                    tempSh[i].is_sh = true

                    delete tempSh[i].is_gl

                    tempSh.splice(j++, 1)
                }
            }
            else
            {
                tempSh[i].start_date = moment(tempSh[i].start_date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                tempSh[i].end_date = moment(tempSh[i].end_date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                tempSh[i].is_sh = true

                delete tempSh[i].is_gl

                result.sh.push(tempSh)
            }
        }

        //console.log('signChckerShBulkSchema', signChckerShBulkSchema)
    }
    //#endregion

    return result
}
//#endregion

const shiftByGroupId = async (groupId) => {
    
}


//#region scheduler main 
const main = async () => {
    try
    {
        //await clear4sRows();
        //await generateSchedules(databasePool)

        //#region scheduler shift generator
        const shiftSql = `
                       with
                        weekly_shifts as (
                            select
                                date_part('week', "date"::date) as week_num,
                                case
                                    when date_part('week', "date"::date) = 9 or date_part('week'::text, "date") = 10 then 
                                        'morning_shift'
                                    when tms2.shift_type = 'morning_shift' then 'night_shift'
                                    when date_part('week', "date"::date)::integer % 2 = 0 then 
                                        'morning_shift'
                                    else 'night_shift'
                                end as shift_type
                            from
                                ${table.tb_m_schedules} tms1
                                full outer join (
                                    select date_part('week', "date"::date) as week_num,
                                       case
                                           when date_part('week', "date"::date)::integer % 2 = 0 then
                                               'morning_shift'
                                           else 'night_shift'
                                           end                         as shift_type
                                    from tb_m_schedules
                                    where date_part('month', "date") = '${currentMonth - 1}'
                                    and date_part('year', "date") = '${currentYear}'
                                    group by week_num, shift_type
                                    order by week_num desc
                                    limit 1
                                ) tms2 on true
                            where 
                                date_part('month', "date") = '${currentMonth}'
                                and date_part('year', "date") = '${currentYear}'
                        ),
                        total_day_weeks as (
                            select 
                                date_part('week', "date"::date) as week_num,
                                count(*) as total_day_of_week
                            from 
                                ${table.tb_m_schedules} 
                            where 
								is_holiday = false or is_holiday is null
							group by 
								week_num
                        )
                    select
                        tms.schedule_id,
                        tms."date",
                        EXTRACT('DOW' FROM tms."date"::timestamp) AS day_of_week,
                        (EXTRACT(WEEK FROM "date"::date) % 2) <> 0 AS is_odd_week, -- determine an weekly should plan
                        TO_CHAR(tms."date"::date, 'dd' ) as date_num,
                        shift.shift_type,
                        tms.is_holiday,
                        shift.week_num,
                        tdw.total_day_of_week,
                        ceiling((date_part('day', tms."date") - date_part('dow', tms."date")) / 7) = 1 as is_first_week
                    from
                        ${table.tb_m_schedules} tms
                        left join (
                            select
                                week_num,
                                shift_type,
                                count(*) as num_shifts
                            from
                                weekly_shifts
                            group by
                                week_num,
                                shift_type
                            order by
                                week_num,
                                shift_type
                        ) shift on date_part('week', tms."date"::date) = shift.week_num and tms.is_holiday is null
                        left join total_day_weeks tdw on date_part('week', tms."date"::date) = tdw.week_num
                    order by 
                        tms."date"
                `
        //console.log('shiftSql', shiftSql)
        const shiftQuery = await databasePool.query(shiftSql)
        const shiftRows = shiftQuery.rows
        //console.log('shiftRows', shiftSql)
        //#endregion

        //#region scheduler bulk temp var
        const mainScheduleBulkSchema = await genMainSchedule()
        const subScheduleBulkSchema = await genSubSchedule(shiftRows)

        const signCheckers = await genSignCheckers(shiftRows)
        const signCheckerTl1BulkSchema = signCheckers.tl1
        const signCheckerTl2BulkSchema = signCheckers.tl2
        const signChckerGlBulkSchema = signCheckers.gl
        const signChckerShBulkSchema = signCheckers.sh
        //console.warn('signCheckers', signCheckers)

        const itemCheckKanbanSchema = await genItemCheckKanbanTrans(shiftRows)
        //#endregion


        //#region scheduler transaction
        /**
         * @param {databasePool} db
         */
        const transaction = await queryTransaction(async (db) => {
            //#region scheduler inserted tb_r_4s_main_schedules
            const mSchema = await bulkToSchema(mainScheduleBulkSchema)
            const mainScheduleInserted = await db.query(`insert into ${table.tb_r_4s_main_schedules} (${mSchema.columns}) values ${mSchema.values} returning *`)
            console.log('tb_r_4s_main_schedules', 'inserted')
            //#endregion

            let subScheduleTemp = []
            let signCheckersTemp = []
            let itemCheckKanbanTemp = []

            for (let mIndex = 0; mIndex < mainScheduleInserted.rows.length; mIndex++)
            {
                //#region scheduler generate main_schedule_id for subScheduleBulkSchema
                for (let subIndex = 0; subIndex < subScheduleBulkSchema.length; subIndex++)
                {
                    subScheduleTemp.push({
                        ...subScheduleBulkSchema[subIndex],
                        uuid: uuid(),
                        main_schedule_id: mainScheduleInserted.rows[mIndex].main_schedule_id
                    })
                }
                //#endregion

                //#region scheduler combine all sign checker schema
                for (let tl1Index = 0; tl1Index < signCheckerTl1BulkSchema.length; tl1Index++)
                {
                    signCheckersTemp.push({
                        main_schedule_id: mainScheduleInserted.rows[mIndex].main_schedule_id,
                        uuid: uuid(),
                        start_date: signCheckerTl1BulkSchema[tl1Index].start_date,
                        end_date: signCheckerTl1BulkSchema[tl1Index].end_date,
                        is_tl_1: true,
                        is_tl_2: null,
                        is_gl: null,
                        is_sh: null,
                    })
                }

                for (let tl2Index = 0; tl2Index < signCheckerTl2BulkSchema.length; tl2Index++)
                {
                    signCheckersTemp.push({
                        main_schedule_id: mainScheduleInserted.rows[mIndex].main_schedule_id,
                        uuid: uuid(),
                        start_date: signCheckerTl2BulkSchema[tl2Index].start_date,
                        end_date: signCheckerTl2BulkSchema[tl2Index].end_date,
                        is_tl_1: null,
                        is_tl_2: true,
                        is_gl: null,
                        is_sh: null,
                    })
                }

                for (let glIndex = 0; glIndex < signChckerGlBulkSchema.length; glIndex++)
                {
                    signCheckersTemp.push({
                        main_schedule_id: mainScheduleInserted.rows[mIndex].main_schedule_id,
                        uuid: uuid(),
                        start_date: signChckerGlBulkSchema[glIndex].start_date,
                        end_date: signChckerGlBulkSchema[glIndex].end_date,
                        is_tl_1: null,
                        is_tl_2: null,
                        is_gl: true,
                        is_sh: null,
                    })
                }

                for (let shIndex = 0; shIndex < signChckerShBulkSchema[0].length; shIndex++)
                {
                    signCheckersTemp.push({
                        main_schedule_id: mainScheduleInserted.rows[mIndex].main_schedule_id,
                        uuid: uuid(),
                        start_date: signChckerShBulkSchema[0][shIndex].start_date,
                        end_date: `func (select "date" from tb_m_schedules where "date" between '${signChckerShBulkSchema[0][shIndex].start_date}' and '${signChckerShBulkSchema[0][shIndex].end_date}' and (is_holiday is null or is_holiday = false) order by schedule_id desc limit 1)`,
                        is_tl_1: null,
                        is_tl_2: null,
                        is_gl: null,
                        is_sh: true,
                    })
                }

                /*  for (let ikIndex = 0; ikIndex < itemCheckKanbanSchema.length; ikIndex++) {
                     itemCheckKanbanTemp.push({
 
                     })
                 } */
                //#endregion
            }

            //#region scheduler inserted tb_r_4s_sub_schedules
            const sSchema = await bulkToSchema(subScheduleTemp)
            await db.query(`insert into ${table.tb_r_4s_sub_schedules} (${sSchema.columns}) values ${sSchema.values}`)
            console.log('tb_r_4s_sub_schedules', 'inserted')
            //#endregion

            //#region scheduler inserted tb_r_4s_schedule_sign_checkers
            //console.log('signCheckersTemp', signCheckersTemp)
            const sgSchema = await bulkToSchema(signCheckersTemp)
            await db.query(`insert into ${table.tb_r_4s_schedule_sign_checkers} (${sgSchema.columns}) values ${sgSchema.values}`)
            console.log('tb_r_4s_schedule_sign_checkers', 'inserted')
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

/* clear4sRows()
    .then((r) => process.exit())
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