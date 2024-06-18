const pg = require('pg')
const table = require('../config/table')
const moment = require('moment')
const { databasePool } = require('../config/database')
const { getRandomInt, padTwoDigits } = require('../helpers/formatting')
const { bulkToSchema } = require('../helpers/schema')
const { uuid } = require('uuidv4')
const { nonShift } = require('./shift.services')

const dateFormatted = (date = '') => (moment(date, 'YYYY-MM-DD').format('YYYY-MM-DD'))

const baseMstScheduleQuery4S = async (
    lineId,
    groupId
) => {
    const mstSql = `select
                        tmoick.om_item_check_kanban_id,
                        tmf.freq_id,
                        tmm.machine_id,
                        tmf.precition_val
                    from
                        ${table.tb_m_om_item_check_kanbans} tmoick
                            join ${table.tb_m_machines} tmm on tmoick.machine_id = tmm.machine_id
                            join ${table.tb_m_freqs} tmf on tmoick.freq_id = tmf.freq_id
                    where
                        tmm.line_id = ${lineId}
                        and tmoick.group_id = ${groupId}
                        and tmoick.deleted_dt is null
                    order by
                        tmf.precition_val`                        

    const kanbanQuery = await databasePool.query(mstSql)
    return kanbanQuery.rows
}

const findScheduleTransaction4S = async (
    year,
    month,
    lineId = null,
    groupId = null,
    freqId = null,
    zoneId = null,
    kanbanId = null
) => {
    let sql = `select
                    tr4sms.main_schedule_id,
                    tr4sms.line_id,
                    tr4sms.group_id,
                    tr4sss.freq_id,
                    tr4sss.zone_id,
                    tr4sss.kanban_id,
                    tr4sss.schedule_id,
                    tms.date,
                    tr4sss.plan_time,
                    tr4sss.actual_time,
                    tmf.precition_val
                from
                    tb_r_4s_main_schedules tr4sms
                        left join tb_r_4s_sub_schedules tr4sss on tr4sms.main_schedule_id = tr4sss.main_schedule_id
                        left join tb_m_schedules tms on tr4sss.schedule_id = tms.schedule_id
                        left join tb_m_freqs tmf on tr4sss.freq_id = tmf.freq_id
                where
                    tr4sms.month_num = ${month}
                    and tr4sms.year_num = ${year}
                    and tr4sms.deleted_dt is null`

    if (lineId)
    {
        sql += ` and tr4sms.line_id = ${lineId}`
    }
    if (groupId)
    {
        sql += ` and tr4sms.group_id = ${groupId}`
    }
    if (freqId)
    {
        sql += ` and tr4sss.freq_id = ${freqId}`
    }
    if (zoneId)
    {
        sql += ` and tr4sss.zone_id = ${zoneId}`
    }
    if (kanbanId)
    {
        sql += ` and tr4sss.kanban_id = ${kanbanId}`
    }

    const query = await databasePool.query(sql)
    if (query && query.rowCount > 0)
    {
        return query.rows
    }

    return null
}

const findSignCheckerTransaction4S = async (
    year,
    month,
    lineId,
    groupId
) => {
    let sql = `select
                    tr4sms.main_schedule_id
                from
                    tb_r_4s_main_schedules tr4sms
                    join tb_r_4s_schedule_sign_checkers tr4sss on tr4sms.main_schedule_id = tr4sss.main_schedule_id
                where
                    tr4sms.month_num = ${month}
                    and tr4sms.year_num = ${year}
                    and tr4sms.line_id = ${lineId}
                    and tr4sms.group_id = ${groupId}`

    //console.log('sql sign checker', sql);
    const query = await databasePool.query(sql)
    if (query && query.rowCount > 0)
    {
        return query.rows
    }

    return null
}

const genDailySchedulePlan = async (
    kanbanRow = {},
    shiftRows = [],
    monthNum,
    yearNum,
    lineId = 0,
    groupId = 0,
    shouldGeneratePlan = true
) => {
    let result = []
    if (kanbanRow.precition_val == 1)
    {
        if (!shiftRows || shiftRows.length == 0)
        {
            shiftRows = await shiftByGroupId(
                yearNum,
                monthNum,
                lineId,
                groupId
            )
        }

        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {
            const exists = result.find((item) =>
                item.group_id == lineId
                && item.line_id == groupId
                && item.kanban_id == shiftRows[sIndex].kanban_id
                && item.zone_id == shiftRows[sIndex].zone_id
                && item.freq_id == shiftRows[sIndex].freq_id
                && item.schedule_id == shiftRows[sIndex].schedule_id
            )

            if (exists)
            {
                continue
            }

            let planTime = null
            if (shiftRows[sIndex].shift_type == 'morning_shift' && !shiftRows[sIndex].is_holiday)
            {
                planTime = dateFormatted(shiftRows[sIndex].date)
            }

            result.push({
                main_schedule_id: null,
                group_id: groupId,
                line_id: lineId,
                kanban_id: kanbanRow.kanban_id,
                zone_id: kanbanRow.zone_id,
                freq_id: kanbanRow.freq_id,
                schedule_id: shiftRows[sIndex].schedule_id,
                shift_type: shiftRows[sIndex].shift_type,
                plan_time: planTime == dateFormatted(shiftRows[sIndex].date) && shouldGeneratePlan ? planTime : null,
                is_holiday: shiftRows[sIndex].is_holiday,
            })
        }
    }

    return result
}

const genWeeklySchedulePlan = async (
    kanbanRow = {},
    shiftRows = [],
    monthNum,
    yearNum,
    lineId,
    groupId,
    shouldGeneratePlan = true
) => {
    const result = []

    if (kanbanRow.precition_val == 7)
    {
        if (!shiftRows || shiftRows.length == 0)
        {
            shiftRows = await shiftByGroupId(
                yearNum,
                monthNum,
                lineId,
                groupId
            )
        }

        let planTimeWeeklyArr = []

        if (shouldGeneratePlan)
        {
            const morningShift = shiftRows.filter((item) => {
                return item.shift_type == 'morning_shift' && !item.is_holiday
            })


            let lastWeekNum = 0
            let dayIncrement = 1
            for (let i = 0; i < morningShift.length; i++)
            {
                if (lastWeekNum != morningShift[i].week_num)
                {
                    const plan = morningShift.filter((item) => {
                        return item.week_num == morningShift[i].week_num
                    })

                    if (plan.length > 0)
                    {
                        planTimeWeeklyArr.push(dateFormatted(plan[getRandomInt(0, plan.length - 1)].date))
                    } else
                    {
                        planTimeWeeklyArr.push(dateFormatted(morningShift[i].date))
                    }

                    lastWeekNum = morningShift[i].week_num
                    dayIncrement++
                }
            }
        }

        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {

            const exists = result.find((item) =>
                lineId == item.line_id
                && item.group_id == groupId
                && item.kanban_id == shiftRows[sIndex].kanban_id
                && item.zone_id == shiftRows[sIndex].zone_id
                && item.freq_id == shiftRows[sIndex].freq_id
                && item.schedule_id == shiftRows[sIndex].schedule_id
            )

            if (exists)
            {
                continue
            }

            let planTime = planTimeWeeklyArr.find((item) => item == dateFormatted(shiftRows[sIndex].date))

            result.push({
                main_schedule_id: null,
                group_id: groupId,
                line_id: lineId,
                kanban_id: kanbanRow.kanban_id,
                zone_id: kanbanRow.zone_id,
                freq_id: kanbanRow.freq_id,
                schedule_id: shiftRows[sIndex].schedule_id,
                shift_type: shiftRows[sIndex].shift_type,
                plan_time: planTime == dateFormatted(shiftRows[sIndex].date) && shouldGeneratePlan ? planTime : null,
                is_holiday: shiftRows[sIndex].is_holiday,
            })
        }
    }

    return result
}

const genMonthlySchedulePlan = async (
    kanbanRow = {},
    shiftRows = [],
    lineId = 0,
    groupId = 0,
    monthNum = 0,
    yearNum = 0,
    shouldGeneratePlan = true
) => {
    const result = []
    if (kanbanRow.precition_val >= 30)
    {
        if (!shiftRows || shiftRows.length == 0)
        {
            shiftRows = await shiftByGroupId(
                yearNum,
                monthNum,
                lineId,
                groupId
            )
        }

        let planTime = null
        if (shouldGeneratePlan)
        {
            const lastMonthPlanSql = `select
                                        tms."date"
                                    from
                                        ${table.tb_r_4s_sub_schedules} trss
                                        join ${table.tb_m_kanbans} tmk on trss.kanban_id = tmk.kanban_id
                                        join ${table.tb_m_zones} tmz on trss.zone_id = tmz.zone_id
                                        join ${table.tb_m_freqs} tmf on trss.freq_id = tmf.freq_id
                                        join ${table.tb_m_schedules} tms on trss.schedule_id = tms.schedule_id
                                    where 
                                        trss.kanban_id = '${kanbanRow.kanban_id}'
                                        and trss.zone_id = '${kanbanRow.zone_id}'
                                        and trss.freq_id = '${kanbanRow.freq_id}'
                                        and tms.date = '${yearNum}-${padTwoDigits(monthNum)}-01'::date - interval '${kanbanRow.precition_val} days'
                                        and tmf.precition_val >= 30
                                    order by
                                        trss.sub_schedule_id desc 
                                    limit 1`

            const lastPlanTimeQuery = await databasePool.query(lastMonthPlanSql)

            if (lastPlanTimeQuery.rows && lastPlanTimeQuery.rowCount > 0)
            {
                planTime = moment(lastPlanTimeQuery.rows[0].date, 'YYYY-MM-DD')
                    .add(kanbanRow.precition_val, 'd')
                    .format('YYYY-MM-DD')

                //MONTHLY should plan on holiday  
                if (
                    kanbanRow.precition_val == 30
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
                        .weekday(getRandomInt(0, 5)) // generate random number 0 - 5 for weekday
                        .format('YYYY-MM-DD')
                }
            }

            if (!planTime)
            {
                // determine validity of kanban precition_val should plan if not already exists before (specially for > 1 month)
                if (kanbanRow.precition_val > 30)
                {
                    //#region existing validity
                    const scheduleExistsSql = `select 
                                                tr4ss.schedule_id
                                            from 
                                                ${table.tb_r_4s_sub_schedules} tr4ss 
                                                join ${table.tb_m_schedules} tms on tr4ss.schedule_id = tms.schedule_id
                                            where 
                                                tr4ss.kanban_id = '${kanbanRow.kanban_id}'
                                                and tr4ss.zone_id = '${kanbanRow.zone_id}'
                                                and tr4ss.freq_id = '${kanbanRow.freq_id}'
                                                and tms.date = '${yearNum}-${padTwoDigits(monthNum)}-01'::date - interval '${kanbanRow.precition_val} days'`

                    const scheduleExists = await databasePool.query(scheduleExistsSql)
                    if (scheduleExists.rowCount > 0)
                    {
                        return result
                    }
                    //#endregion
                }

                const morningShift = shiftRows.filter((item) => {
                    if (kanbanRow.precition_val == 30)
                    {
                        return item.is_holiday_schedule
                    }

                    return item.shift_type == 'morning_shift'
                });

                planTime = morningShift[getRandomInt(0, morningShift.length - 1)].date;
                if (!planTime)
                {
                    const lastDay = moment(`${yearNum}-${padTwoDigits(monthNum)}-01`, 'YYYY-MM-DD')
                        .endOf('month')
                        .format('D');

                    planTime = `${yearNum}-${padTwoDigits(monthNum)}-${getRandomInt(0, lastDay)}`;
                }
            }
        }


        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {
            const exists = result.find((item) =>
                lineId == item.line_id
                && item.group_id == groupId
                && item.kanban_id == shiftRows[sIndex].kanban_id
                && item.zone_id == shiftRows[sIndex].zone_id
                && item.freq_id == shiftRows[sIndex].freq_id
                && item.schedule_id == shiftRows[sIndex].schedule_id
            )

            if (exists)
            {
                continue
            }

            result.push({
                main_schedule_id: null,
                group_id: groupId,
                line_id: lineId,
                kanban_id: kanbanRow.kanban_id,
                zone_id: kanbanRow.zone_id,
                freq_id: kanbanRow.freq_id,
                schedule_id: shiftRows[sIndex].schedule_id,
                shift_type: shiftRows[sIndex].shift_type,
                plan_time: planTime == dateFormatted(shiftRows[sIndex].date) && shouldGeneratePlan ? planTime : null,
                is_holiday: shiftRows[sIndex].is_holiday,
            })
        }
    }

    return result
}


/**
 * function genSingleMonthlySubScheduleSchema
 * 
 * @param {kanbamRows} kanbanRow 
 * @param {lineGroup} lineGroup 
 * @param {Array<*>} shiftRows 
 * @param {string} planTime 
 * @returns {Array<*>}
 */
const genSingleMonthlySubScheduleSchemaOM = (kanbanRow, lineGroup, shiftRows = [], planTime = '') => {
    const result = []
    for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
    {
        result.push({
            uuid: uuid(),
            om_main_schedule_id: kanbanRow.om_main_schedule_id,
            // group_id: lineGroup.group_id,
            // line_id: lineGroup.line_id,
            om_item_check_kanban_id: kanbanRow.om_item_check_kanban_id,
            freq_id: kanbanRow.freq_id,
            machine_id: kanbanRow.machine_id,
            schedule_id: shiftRows[sIndex].schedule_id,
            plan_time: planTime && planTime == dateFormatted(shiftRows[sIndex].date) ? planTime : null, // validate if date plan is equal the date loop
            is_holiday: shiftRows[sIndex].is_holiday,
        })
    }

    return result
}

/**
* 
* @param {number} currentYear 
* @param {number} currentMonth 
* @param {Array<*>} lineGroup 
* @param {Array<*>} shiftRows 
* @returns {Promise<Array<*>>}
*/
const genMonthlySignCheckerSchemaOM = async (currentYear, currentMonth, lineGroup, shiftRows = []) => {
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


/**
* function genMonthlySubScheduleSchema
* 
* @param {number} currentYear
* @param {number} currentMonth
* @param {Object} lineGroup
* @param {Array<*>} shiftRows
* @param {pg.QueryResultRow} shiftRows 
* 
* @returns {Promise<Array<*>>} []
*/
const genMonthlySubScheduleSchemaOM = async (currentYear, currentMonth, lineGroup, shiftRows = []) => {
    const result = []

    //#region scheduler fetch all item check
    const mstSql = `select
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
                tmf.precition_val`

    const itemCheckQuery = await databasePool.query(mstSql)
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

/**
* 
* @param {signChecker} signCheckerSchema 
* @returns {Object}
*/
const singleSignCheckerSqlFromSchemaOM = async (currentYear, currentMonth, lineGroup, shiftRows = [], mainScheduleId) => {
    const signCheckerSchema = await genMonthlySignCheckerSchemaOM(currentYear, currentMonth, lineGroup, shiftRows)
    const signCheckersTemp = []

    for (let tl1Index = 0; tl1Index < signCheckerSchema.tl.length; tl1Index++)
    {
        signCheckersTemp.push({
            uuid: uuid(),
            om_main_schedule_id: mainScheduleId,
            uuid: uuid(),
            start_date: signCheckerSchema.tl[tl1Index].start_date,
            end_date: signCheckerSchema.tl[tl1Index].end_date,
            is_tl: true,
            is_gl: null,
        })
    }

    for (let glIndex = 0; glIndex < signCheckerSchema.gl.length; glIndex++)
    {
        signCheckersTemp.push({
            uuid: uuid(),
            om_main_schedule_id: mainScheduleId,
            uuid: uuid(),
            start_date: signCheckerSchema.gl[glIndex].start_date,
            end_date: signCheckerSchema.gl[glIndex].end_date,
            is_tl: null,
            is_gl: true,
        })
    }

    const schema = await bulkToSchema(signCheckersTemp)
    return schema
}

//#region scheduler delete all for testing purpose
const clearOmTransactionRows = async () => {
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
//#endregion

module.exports = {
    genMonthlySubScheduleSchemaOM: genMonthlySubScheduleSchemaOM,
    genMonthlySignCheckerSchemaOM: genMonthlySignCheckerSchemaOM,
    genSingleMonthlySubScheduleSchemaOM: genSingleMonthlySubScheduleSchemaOM,
    singleSignCheckerSqlFromSchemaOM: singleSignCheckerSqlFromSchemaOM,
    clearOmTransactionRows: clearOmTransactionRows
}