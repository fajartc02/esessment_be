const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })


const moment = require('moment')
const { uuid } = require('uuidv4')

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

        currentMonthDay.week_num = `func date_part('week', '${currentMonthDay.date}'::date)`
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

//#region scheduler main 
const main = async () => {
    try
    {
        /* await databasePool.query(`DELETE FROM ${table.tb_m_schedules} CASCADE`)
        await databasePool.query(`ALTER TABLE ${table.tb_m_schedules} ALTER COLUMN schedule_id RESTART WITH 1`)
        await generateSchedules(databasePool) */

        //#region scheduler shift generator
        const shiftSql = `
                       with
                        weekly_shifts as (
                            select
                                week_num,
                                case
                                    when week_num = 9
                                    or week_num = 10 then 'morning_shift'
                                    when week_num % 2 = 0 then 'morning_shift'
                                    else 'night_shift'
                                end as shift_type
                            from
                                ${table.tb_m_schedules}
                            where 
                                date_part('month', "date") = '${currentMonth}'
                                and date_part('year', "date") = '${currentYear}'
                        )
                    select
                        tms.schedule_id,
                        tms."date",
                        TO_CHAR(tms."date"::date, 'dd' ) as date_num,
                        shift.shift_type,
                        tms.is_holiday,
                        shift.week_num
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
                        ) shift on tms.week_num = shift.week_num and tms.is_holiday is null
                    order by 
                        tms."date"
                `
        const shiftQuery = await databasePool.query(shiftSql)
        const shiftRows = shiftQuery.rows
        //#endregion

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
                    tb_m_kanbans tmk
                    join tb_m_zones tmz on tmk.zone_id = tmz.zone_id
                    join tb_m_freqs tmf on tmf.freq_id = tmz.freq_id
            `)
        const kanbanRows = kanbanQuery.rows
        //#endregion

        //#region scheduler bulk temp var
        const mainScheduleBulkSchema = []
        const subScheduleBulkSchema = []
        const signCheckerTl1BulkSchema = []
        const signCheckerTl2BulkSchema = []
        const signChckerGlBulkSchema = []
        const signChckerShBulkSchema = []
        //#endregion

        //#region scheduler added line to mainSchedule
        //const lineQuery = await databasePool.query(`select * from ${table.tb_m_lines} order by line_id asc limit 6`)
        const lgQuery = await databasePool.query(`
                select 
                    tml.line_id,
                    tmg.group_id
                from 
                    (select * from tb_m_lines order by line_id asc limit 1) tml,
                    (select * from tb_m_groups where group_nm in ('WHITE', 'RED')) tmg
            `)

        for (let lnIndex = 0; lnIndex < lgQuery.rows.length; lnIndex++)
        {
            mainScheduleBulkSchema.push({
                uuid: uuid(),
                month_num: currentMonth,
                year_num: currentYear,
                line_id: lgQuery.rows[lnIndex].line_id,
                group_id: lgQuery.rows[lnIndex].group_id,
            })
        }

        //console.log('mainschedule', mainScheduleBulkSchema)
        //#endregion

        //#region scheduler added group to mainSchedule
        /* const groupQuery = await databasePool.query(`select * from ${table.tb_m_groups} where group_nm in ('WHITE', 'RED')`)
        groupQuery.rows.forEach((group, gIndex) => {
            
        }) */
        //#endregion

        //#region scheduler generate sub schedule schema
        {
            let countSame = 0
            
            for (let kIndex = 0; kIndex < kanbanRows.length; kIndex++)
            {
                let planTime = null
                
                if (kanbanRows[kIndex - 1].freq_id == kanbanRows[kIndex].freq_id){
                    countSame++
                }

                if (kanbanRows[kIndex].precition_val > 1)
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
                        planTime = moment(lastPlanTimeQuery.rows[0].date, 'YYYY-MM-DD').add(kanbanRows[kIndex].precition_val, 'd').format('YYYY-MM-DD')
                    }
                    else
                    {

                        //planTime = moment(shiftRows[sIndex].date, 'YYYY-MM-DD').add(precitionVal, 'd').format('YYYY-MM-DD')
                    }
                }
                else
                {

                }

                for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
                {

                    switch (shiftRows[sIndex].shift_type)
                    {
                        case 'morning_shift':
                            break;
                        case 'night_shift':
                        default:
                            break;
                    }

                    if (planTime)
                    {
                        const scheduleIdQuery = `select schedule_id from ${table.tb_m_schedules} where "date" = '${planTime}' limit 1`
                        const scheduleId = await databasePool.query(scheduleIdQuery)
                        if (scheduleId.rowCount == 0)
                        {
                            console.log('scheduleIdQuery', {
                                planTime: planTime,
                                query: scheduleIdQuery,
                                freq: kanbanRows[kIndex].freq_nm,
                                logic: moment(shiftRows[sIndex].date, 'YYYY-MM-DD').add(precitionVal, 'd').format('YYYY-MM-DD')
                            })
                        }
                    }

                    subScheduleBulkSchema.push({
                        uuid: uuid(),
                        main_schedule_id: null,
                        kanban_id: kanbanRows[kIndex].kanban_id,
                        zone_id: kanbanRows[kIndex].zone_id,
                        freq_id: kanbanRows[kIndex].freq_id,
                        schedule_id: shiftRows[sIndex].schedule_id,
                        shift: shiftRows[sIndex].shift_type,
                        plan_time: planTime && planTime == moment(shiftRows[sIndex].date, 'YYYY-MM-DD').format('YYYY-MM-DD') ? planTime : null,
                    })
                }
            }

            //console.log('subScheduleBulkSchema', subScheduleBulkSchema.length)
        }
        //#endregion

        //#region scheduler general tl1 & tl2 sign checker
        {
            for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
            {
                if (!shiftRows[sIndex].is_holiday)
                {
                    signCheckerTl1BulkSchema.push({
                        main_schedule_id: null,
                        week_num: shiftRows[sIndex].week_num,
                        is_tl_1: true,
                        start_date: moment(shiftRows[sIndex].date, 'YYYY-MM-DD').format('YYYY-MM-DD'),
                        end_date: moment(shiftRows[sIndex].date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                    })

                    signCheckerTl2BulkSchema.push({
                        main_schedule_id: null,
                        week_num: shiftRows[sIndex].week_num,
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
            const glSignQuery = await databasePool.query(`
                with
                    week as (
                        select
                            week_num,
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
                        *
                    from (
                        select
                            week.week_num,
                            week.col_span,
                            min("date") as start,
                            max("date") as end
                        from 
                            ${table.tb_m_schedules} tms
                            join week on tms.week_num = week.week_num
                        group by
                            week.week_num, week.col_span
                        order by week.week_num
                    ) res
                    left join lateral (
                        select count(*) as total_holiday from ${table.tb_m_schedules} where is_holiday = true and "date" between res.start and res.end 
                    ) hol on true
                `
            )

            for (let glIndex = 0; glIndex < glSignQuery.rows.length; glIndex++)
            {
                signChckerGlBulkSchema.push({
                    main_schedule_id: null,
                    week_num: glSignQuery.rows[glIndex].week_num,
                    start_date: moment(glSignQuery.rows[glIndex].start, 'YYYY-MM-DD').format('YYYY-MM-DD'),
                    end_date: moment(glSignQuery.rows[glIndex].end, 'YYYY-MM-DD').format('YYYY-MM-DD'),
                    col_span: glSignQuery.rows[glIndex].col_span,
                    is_gl: true,
                })
            }

            //console.log('signChckerGlBulkSchema', signChckerGlBulkSchema)
        }
        //#endregion

        //#region scheduler generate sh sign checker
        {
            let tempSh = []
            signChckerGlBulkSchema.forEach((gl) => tempSh.push(Object.assign({}, gl)))

            for (var i = 0; i < tempSh.length; ++i)
            {
                if (tempSh[i].col_span > 1)
                {
                    for (var j = i + 1; j < tempSh.length; ++j)
                    {
                        tempSh[i].week_num = i + 1
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
                    tempSh[i].week_num = i + 1
                    tempSh[i].start_date = moment(tempSh[i].start_date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                    tempSh[i].end_date = moment(tempSh[i].end_date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                    tempSh[i].is_sh = true

                    delete tempSh[i].is_gl

                    signChckerShBulkSchema.push(tempSh)
                }
            }

            //console.log('signChckerShBulkSchema', signChckerShBulkSchema)
        }
        //#endregion


        //#region scheduler transaction
        /**
         * @param {databasePool} db
         */
        const transaction = await queryTransaction(async (db) => {
            //#region scheduler delete tb_r_4s_main_schedules, tb_r_4s_sub_schedules, tb_r_4s_schedule_sign_checkers for testing purpose
            const clearRows = async () => {
                await db.query(`DELETE FROM ${table.tb_r_4s_main_schedules} CASCADE`)
                await db.query(`ALTER TABLE ${table.tb_r_4s_main_schedules} ALTER COLUMN main_schedule_id RESTART WITH 1`)

                await db.query(`DELETE FROM ${table.tb_r_4s_sub_schedules} CASCADE`)
                await db.query(`ALTER TABLE ${table.tb_r_4s_sub_schedules} ALTER COLUMN sub_schedule_id RESTART WITH 1`)

                await db.query(`DELETE FROM ${table.tb_r_4s_schedule_sign_checkers} CASCADE`)
                await db.query(`ALTER TABLE ${table.tb_r_4s_schedule_sign_checkers} ALTER COLUMN sign_checker_id RESTART WITH 1`)
            }
            await clearRows()
            //#endregion

            //#region scheduler inserted tb_r_4s_main_schedules
            const mSchema = await bulkToSchema(mainScheduleBulkSchema)
            const mainScheduleInserted = await db.query(`insert into ${table.tb_r_4s_main_schedules} (${mSchema.columns}) values ${mSchema.values} returning *`)
            console.log('tb_r_4s_main_schedules', 'inserted')
            //#endregion

            let subScheduleTemp = []
            let signCheckersTemp = []

            for (let mIndex = 0; mIndex < mainScheduleInserted.rows.length; mIndex++)
            {
                //#region scheduler generate main_schedule_id for subScheduleBulkSchema
                for (let subIndex = 0; subIndex < subScheduleBulkSchema.length; subIndex++)
                {
                    subScheduleTemp.push({
                        ...subScheduleBulkSchema[subIndex],
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
                        week_num: signCheckerTl1BulkSchema[tl1Index].week_num,
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
                        week_num: signCheckerTl2BulkSchema[tl2Index].week_num,
                        start_date: signCheckerTl2BulkSchema[tl2Index].start_date,
                        end_date: signCheckerTl2BulkSchema[tl2Index].end_date,
                        is_tl_1: null,
                        is_tl_2: false,
                        is_gl: null,
                        is_sh: null,
                    })
                }

                for (let glIndex = 0; glIndex < signChckerGlBulkSchema.length; glIndex++)
                {
                    signCheckersTemp.push({
                        main_schedule_id: mainScheduleInserted.rows[mIndex].main_schedule_id,
                        uuid: uuid(),
                        week_num: signChckerGlBulkSchema[glIndex].week_num,
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
                        week_num: signChckerShBulkSchema[0][shIndex].week_num,
                        start_date: signChckerShBulkSchema[0][shIndex].start_date,
                        end_date: `func (select "date" from tb_m_schedules where "date" between '${signChckerShBulkSchema[0][shIndex].start_date}' and '${signChckerShBulkSchema[0][shIndex].end_date}' and (is_holiday is null or is_holiday = false) order by schedule_id desc limit 1)`,
                        is_tl_1: null,
                        is_tl_2: null,
                        is_gl: null,
                        is_sh: true,
                    })
                }
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


main()
    .then((result) => {
        process.exit()
    })
    .catch((error) => {
        process.exit()
    })