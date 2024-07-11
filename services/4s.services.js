/**
 * @typedef {Object} kanbamRows
 * @property {number} kanban_id
 * @property {number} zone_id
 * @property {number} freq_id
 * @property {number|null} main_schedule_id
 */

/**
 * @typedef {Object} lineGroup
 * @property {number} line_id
 * @property {number} group_id
 */

/**
 * @typedef {Object} signChecker
 * @property {Array<Object>} tl1
 * @property {Array<Object>} tl2
 * @property {Array<Object>} gl
 * @property {Array<Object>} sh
 */

const { databasePool, database } = require('../config/database')
const pg = require('pg')
const table = require('../config/table')
const moment = require('moment')
const { getRandomInt, padTwoDigits } = require('../helpers/formatting')
const { bulkToSchema } = require('../helpers/schema')
const { uuid } = require('uuidv4')
const { addBusinessDaysToDate } = require('../helpers/date')
const { shiftByGroupId, nonShift } = require('./shift.services')

const dateFormatted = (date = '') => (moment(date, 'YYYY-MM-DD').format('YYYY-MM-DD'))

const baseMstScheduleQuery4S = async (
    lineId,
    groupId
) => {
    const mstSql = `select
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
                    where 
                        tmz.line_id = ${lineId}
                        and tmk.group_id = ${groupId}
                        and tmk.deleted_dt is null
                    order by
                        tmk.group_id`

    const kanbanQuery = await database.query(mstSql)
    return kanbanQuery.rows
}

const findScheduleTransaction4S = async (
    year,
    month,
    lineId = null,
    groupId = null,
    freqId = null,
    zoneId = null,
    kanbanId = null,
    scheduleId = null
) => {
    let filterSub = []
    let filterMain = []

    if (lineId)
    {
        filterMain.push(`tr4sms.line_id = ${lineId}`)
    }
    if (groupId)
    {
        filterMain.push(`tr4sms.group_id = ${groupId}`)
    }

    if (freqId)
    {
        filterSub.push(`tr4sss.freq_id = ${freqId}`)
    }
    if (zoneId)
    {
        filterSub.push(`tr4sss.zone_id = ${zoneId}`)
    }
    if (kanbanId)
    {
        filterSub.push(`tr4sss.kanban_id = ${kanbanId}`)
    }
    if (scheduleId)
    {
        filterSub.push(`tr4sss.schedule_id = ${scheduleId}`)
    }

    let selectSub = [
        'tr4sss.freq_id',
        'tr4sss.zone_id',
        'tr4sss.kanban_id',
        'tr4sss.schedule_id',
        'tms.date',
        'tr4sss.plan_time',
        'tr4sss.actual_time',
        'tmf.precition_val'
    ]

    let joinSub = `left join tb_r_4s_sub_schedules tr4sss on tr4sms.main_schedule_id = tr4sss.main_schedule_id
                    left join tb_m_schedules tms on tr4sss.schedule_id = tms.schedule_id
                    left join tb_m_freqs tmf on tr4sss.freq_id = tmf.freq_id`

    let sql = `select
                    tr4sms.main_schedule_id,
                    tr4sms.line_id,
                    tr4sms.group_id
                    ${filterSub.length > 0 ? ', ' + selectSub.join(', ') : ''}
                from
                    tb_r_4s_main_schedules tr4sms
                    ${filterSub.length > 0 ? joinSub : ''}
                where
                    tr4sms.month_num = ${month}
                    and tr4sms.year_num = ${year}
                    and tr4sms.deleted_dt is null
                    ${filterMain.length > 0 ? 'and ' + filterMain.join(' and ') : ''}
                    ${filterSub.length > 0 ? 'and ' + filterSub.join(' and ') : ''}`

    const query = await database.query(sql)
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
    groupId,
    startDate = null,
    endDate = null,
    isTl1 = null,
    isTl2 = null,
    isGl = null,
    isSh = null
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

    if (startDate)
    {
        sql += ` and tr4sss.start_date = '${startDate}'`
    }
    if (endDate)
    {
        sql += ` and tr4sss.end_date = '${endDate}'`
    }
    if (isTl1)
    {
        sql += ` and tr4sss.is_tl_1 = true`
    }
    if (isTl2)
    {
        sql += ` and tr4sss.is_tl_2 = true`
    }
    if (isGl)
    {
        sql += ` and tr4sss.is_gl = true`
    }
    if (isSh)
    {
        sql += ` and tr4sss.is_sh = true`
    }

    //console.log('sql sign checker', sql);
    const query = await database.query(sql)
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
            if (lineId == 8 || lineId == 9)
            {
                shiftRows = await shiftByGroupId(
                    yearNum,
                    monthNum,
                    lineId,
                    groupId
                )
            }
            else
            {
                shiftRows = await nonShift(
                    yearNum,
                    monthNum
                )
            }
        }

        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {
            let planTime = null
            if (
                !shiftRows[sIndex].is_holiday
                && (lineId == 8 || lineId == 9)
                && shiftRows[sIndex].shift_type == 'morning_shift'
            )
            {
                planTime = dateFormatted(shiftRows[sIndex].date)
            }
            else if (!shiftRows[sIndex].is_holiday && lineId != 8 && lineId != 9)
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
                shift_type: lineId == 8 || lineId == 9 ? shiftRows[sIndex].shift_type : null,
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
            if (lineId == 8 || lineId == 9)
            {
                shiftRows = await shiftByGroupId(
                    yearNum,
                    monthNum,
                    lineId,
                    groupId
                )
            }
            else
            {
                shiftRows = await nonShift(
                    yearNum,
                    monthNum
                )
            }
        }

        let planTimeWeeklyArr = []

        if (shouldGeneratePlan)
        {
            const morningShift = shiftRows.filter((item) => {
                if (lineId == 8 || lineId == 9)
                {
                    return item.shift_type == 'morning_shift' && !item.is_holiday
                }

                return !item.is_holiday
            })

            let lastWeekNum = 0

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
                }
            }
        }

        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {

            /*  const exists = result.find((item) =>
                 lineId == item.line_id
                 && item.group_id == groupId
                 && item.kanban_id == kanbanRow.kanban_id
                 && item.zone_id == kanbanRow.zone_id
                 && item.freq_id == kanbanRow.freq_id
                 && item.schedule_id == shiftRows[sIndex].schedule_id
             )
 
             if (exists)
             {
                 continue
             } */

            let planTime = planTimeWeeklyArr.find((item) => item == dateFormatted(shiftRows[sIndex].date))

            result.push({
                main_schedule_id: null,
                group_id: groupId,
                line_id: lineId,
                kanban_id: kanbanRow.kanban_id,
                zone_id: kanbanRow.zone_id,
                freq_id: kanbanRow.freq_id,
                schedule_id: shiftRows[sIndex].schedule_id,
                shift_type: lineId == 8 || lineId == 9 ? shiftRows[sIndex].shift_type : null,
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
            if (lineId == 8 || lineId == 9)
            {
                shiftRows = await shiftByGroupId(
                    yearNum,
                    monthNum,
                    lineId,
                    groupId
                )
            }
            else
            {
                shiftRows = await nonShift(
                    yearNum,
                    monthNum
                )
            }
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

            const lastPlanTimeQuery = await database.query(lastMonthPlanSql)

            if (lastPlanTimeQuery.rows && lastPlanTimeQuery.rowCount > 0)
            {
                planTime = moment(lastPlanTimeQuery.rows[0].date, 'YYYY-MM-DD')
                    .clone()
                    .add(kanbanRow.precition_val, 'd')

                //MONTHLY should plan on holiday  
                if (
                    kanbanRow.precition_val == 30
                    && moment(planTime).day() != 6
                )
                {
                    //console.log('platime before', planTime)
                    planTime = moment(planTime)
                        .clone()
                        .weekday(6)

                    //console.log('platime after', planTime)
                }
                //2 MONTH should plan on week day
                else if (kanbanRow.precition_val > 30 && moment(planTime).day() == 6 || moment(planTime).day() == 7)
                {
                    planTime = moment(planTime)
                        .clone()
                        .weekday(getRandomInt(0, 5)) // generate random number 0 - 5 for weekday
                }
            }

            if (!planTime && kanbanRow.precition_val > 30)
            {
                // determine validity of kanban precition_val should plan if not already exists before (specially for > 1 month)
                //#region existing validity
                const scheduleExistsSql = `select 
                                                tr4ss.schedule_id
                                            from 
                                                ${table.tb_r_4s_sub_schedules} tr4ss 
                                                join ${table.tb_m_schedules} tms on tr4ss.schedule_id = tms.schedule_id
                                            where 
                                                tr4ss.kanban_id = '${kanbanRow.kanban_id}'
                                                and tr4ss.zone_id = '${kanbanRow.zone_id}'
                                                and tr4ss.freq_id = '${kanbanRow.freq_id}'`

                const scheduleExists = await database.query(scheduleExistsSql)
                if (scheduleExists.rowCount > 0)
                {
                    return result
                }
                //#endregion
            }

            const morningShift = shiftRows.filter((item) => {
                if (kanbanRow.precition_val == 30)
                {
                    return item.is_holiday
                }

                if (lineId == 8 || lineId == 9)
                {
                    return item.shift_type == 'morning_shift'
                }

                return true;
            });

            planTime = morningShift[getRandomInt(0, morningShift.length - 1)].date;
            if (!planTime)
            {
                const lastDay = moment(`${yearNum}-${padTwoDigits(monthNum)}-01`, 'YYYY-MM-DD')
                    .endOf('month')
                    .format('D');

                planTime = `${yearNum}-${padTwoDigits(monthNum)}-${padTwoDigits(getRandomInt(1, lastDay))}`;
            }
        }

        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {
            /* const exists = result.find((item) =>
                lineId == item.line_id
                && item.group_id == groupId
                && item.kanban_id == kanbanRow.kanban_id
                && item.zone_id == kanbanRow.zone_id
                && item.freq_id == kanbanRow.freq_id
                && item.schedule_id == shiftRows[sIndex].schedule_id
            )

            if (exists)
            {
                continue
            } */

            result.push({
                main_schedule_id: null,
                group_id: groupId,
                line_id: lineId,
                kanban_id: kanbanRow.kanban_id,
                zone_id: kanbanRow.zone_id,
                freq_id: kanbanRow.freq_id,
                schedule_id: shiftRows[sIndex].schedule_id,
                shift_type: lineId == 8 || lineId == 9 ? shiftRows[sIndex].shift_type : null,
                plan_time: dateFormatted(planTime) == dateFormatted(shiftRows[sIndex].date) ? planTime : null,
                is_holiday: shiftRows[sIndex].is_holiday,
            })
        }
    }

    return result
}

const mapSchemaPlanKanban4S = async (
    lineId,
    groupId,
    precition_val,
    freqId,
    zoneId,
    kanbanId,
    monthNum = 0,
    yearNum = 0,
    shiftRows = [],
    validate = false,
    shouldGeneratePlan = true
) => {
    const result = []

    if (validate)
    {
        const find = await findScheduleTransaction4S(
            yearNum,
            monthNum,
            lineId,
            groupId,
            freqId,
            zoneId,
            kanbanId
        )

        if (find || (find?.length ?? 0) > 0)
        {
            //console.log('exists', JSON.stringify(find));
            return result;
        }
    }


    if (!shiftRows || shiftRows.length == 0)
    {
        if (lineId == 8 || lineId == 9)
        {
            shiftRows = await shiftByGroupId(
                yearNum,
                monthNum,
                lineId,
                groupId
            )
        }
        else
        {
            shiftRows = await nonShift(
                yearNum,
                monthNum
            )
        }
    }

    const kanbanRow = {
        precition_val: precition_val,
        kanban_id: kanbanId,
        freq_id: freqId,
        zone_id: zoneId,
    }

    const monthly = await genMonthlySchedulePlan(
        kanbanRow,
        shiftRows,
        lineId,
        groupId,
        monthNum,
        yearNum,
        shouldGeneratePlan
    )

    const weekly = await genWeeklySchedulePlan(
        kanbanRow,
        shiftRows,
        monthNum,
        yearNum,
        lineId,
        groupId,
        shouldGeneratePlan
    )

    const daily = await genDailySchedulePlan(
        kanbanRow,
        shiftRows,
        monthNum,
        yearNum,
        lineId,
        groupId,
        shouldGeneratePlan
    )

    if (monthly.length > 0)
    {
        result.push(...monthly)
    }

    if (weekly.length > 0)
    {
        result.push(...weekly)
    }

    if (daily.length > 0)
    {
        result.push(...daily)
    }

    return result
}

/**
* function genMonthlySubScheduleSchema
* 
* @param {number} yearNum
* @param {number} monthNum
* @param {Object} lineGroup
* @param {Array<*>} shiftRows
* @param {pg.QueryResultRow} shiftRows 
* 
* @returns {Promise<Array<*>>} []
*/
const genMonthlySubScheduleSchema = async (
    yearNum,
    monthNum,
    lineGroup,
    shiftRows = []
) => {
    const result = []

    //#region scheduler fetch all kanban
    const kanbanRows = await baseMstScheduleQuery4S(
        lineGroup.line_id,
        lineGroup.group_id
    )

    if (kanbanRows.length == 0)
    {
        return result
    }
    //#endregion

    //#region processing sub schedule schema
    {
        if (!shiftRows || (shiftRows?.length ?? 0) == 0)
        {
            if (lineGroup.line_id == 8 || lineGroup.line_id == 9)
            {
                shiftRows = await shiftByGroupId(
                    yearNum,
                    monthNum,
                    lineGroup.line_id,
                    lineGroup.group_id,
                )
            }
            else
            {
                shiftRows = await nonShift(
                    yearNum,
                    monthNum
                )
            }
        }

        for (let kIndex = 0; kIndex < kanbanRows.length; kIndex++)
        {
            const allPlan = await mapSchemaPlanKanban4S(
                lineGroup.line_id,
                lineGroup.group_id,
                kanbanRows[kIndex].precition_val,
                kanbanRows[kIndex].freq_id,
                kanbanRows[kIndex].zone_id,
                kanbanRows[kIndex].kanban_id,
                monthNum,
                yearNum,
                shiftRows
            )

            if (allPlan.length > 0)
            {
                result.push(...allPlan)
            }
        }
    }
    //#endregion

    console.log('length line_id group_id', lineGroup.line_id, lineGroup.group_id, result.length);
    return result
}


/**
* 
* @param {number} yearNum 
* @param {number} monthNum 
* @param {Array<*>} lineGroup 
* @param {Array<*>} shiftRows 
* @returns {Promise<Array<*>>}
*/
const genMonthlySignCheckerSchema = async (yearNum, monthNum, lineGroup, shiftRows = []) => {
    const result = {
        tl1: [],
        tl2: [],
        gl: [],
        sh: []
    }

    const find = await findSignCheckerTransaction4S(
        yearNum,
        monthNum,
        lineGroup.line_id,
        lineGroup.group_id
    )

    // will skip generating if already exists
    if (find && find.length > 0)
    {
        //console.log('should skip generating sign checker');
        return result
    }

    if (!shiftRows || shiftRows.length == 0)
    {
        if (lineGroup.line_id == 8 || lineGroup.line_id == 9)
        {
            shiftRows = await shiftByGroupId(
                yearNum,
                monthNum,
                lineGroup.line_id,
                lineGroup.group_id
            )
        }
        else
        {
            shiftRows = await nonShift(
                yearNum,
                monthNum
            )
        }
    }

    //#region scheduler generate tl1 & tl2 sign checker
    {
        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {
            if (!shiftRows[sIndex].is_holiday)
            {
                result.tl1.push({
                    main_schedule_id: null,
                    group_id: lineGroup.group_id,
                    line_id: lineGroup.line_id,
                    is_tl_1: true,
                    start_date: moment(shiftRows[sIndex].date, 'YYYY-MM-DD').format('YYYY-MM-DD'),
                    end_date: moment(shiftRows[sIndex].date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                })

                result.tl2.push({
                    main_schedule_id: null,
                    group_id: lineGroup.group_id,
                    line_id: lineGroup.line_id,
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
                                date_part('month', "date") = '${monthNum}'
                                and date_part('year', "date") = '${yearNum}'
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
                                and date_part('month', "date") = '${monthNum}'
                                and date_part('year', "date") = '${yearNum}'
                            order by
                                date desc
                            limit 1
                        ) ended on true
                `

            //console.log('glSignSql', glSignSql)
            //logger(glSignSql)
            const glSignQuery = await database.query(glSignSql)

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

            //logger(result.gl.length)
            //console.log('result.gl', result.gl)
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

            if (tempSh[i + 1])
            {
                let tempEndDate = tempSh[i].end_date

                tempSh[i].col_span = tempSh[i].col_span + tempSh[i + 1].col_span
                tempSh[i].start_date = moment(tempSh[i].start_date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                tempSh[i].end_date = moment(tempSh[i + 1].end_date, 'YYYY-MM-DD').format('YYYY-MM-DD')
                tempSh[i].is_sh = true

                if (moment(tempSh[i].end_date).valueOf() < moment(tempSh[i].start_date).valueOf())
                {
                    tempSh[i].end_date = tempEndDate
                }

                delete tempSh[i].is_gl

                result.sh.push(tempSh[i])

                if (
                    tempSh[i].line_id == tempSh[i + 1].line_id
                    && tempSh[i].group_id == tempSh[i + 1].group_id
                )
                {
                    tempSh.splice(i + 1, 1)
                }
            }
            else
            {
                delete tempSh[i].is_gl
                tempSh[i].is_sh = true

                result.sh.push(tempSh[i])
            }
        }

        //console.log('result.sh', result.sh)
    }
    //#endregion

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
const genSingleMonthlySubScheduleSchema = async (
    kanbanRow,
    lineGroup,
    shiftRows = [],
    planTime = ''
) => {
    const result = []
    for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
    {
        result.push({
            uuid: uuid(),
            main_schedule_id: kanbanRow.main_schedule_id,
            kanban_id: kanbanRow.kanban_id,
            zone_id: kanbanRow.zone_id,
            freq_id: kanbanRow.freq_id,
            schedule_id: shiftRows[sIndex].schedule_id,
            shift_type: lineGroup.line_id == 8 || lineGroup.line_id == 9 ? shiftRows[sIndex].shift_type : null,
            plan_time: planTime && planTime == dateFormatted(shiftRows[sIndex].date) ? planTime : null,
            is_holiday: shiftRows[sIndex].is_holiday,
        })
    }

    const schema = await bulkToSchema(result)
    return schema
}

/**
* 
* @param {signChecker} signCheckerSchema 
* @returns {Object}
*/
const genSingleSignCheckerSqlFromSchema = async (
    yearNum,
    monthNum,
    lineGroup,
    shiftRows = [],
    mainScheduleId
) => {
    if (!shiftRows || shiftRows.length == 0)
    {
        if (lineGroup.line_id == 8 || lineGroup.line_id == 9)
        {
            shiftRows = await shiftByGroupId(
                yearNum,
                monthNum,
                lineGroup.line_id,
                lineGroup.group_id
            )
        }
        else
        {
            shiftRows = await nonShift(
                yearNum,
                monthNum
            )
        }
    }

    const signCheckerSchema = await genMonthlySignCheckerSchema(yearNum, monthNum, lineGroup, shiftRows)
    const signCheckersTemp = []

    for (let tl1Index = 0; tl1Index < signCheckerSchema.tl1.length; tl1Index++)
    {
        signCheckersTemp.push({
            main_schedule_id: mainScheduleId,
            uuid: uuid(),
            start_date: signCheckerSchema.tl1[tl1Index].start_date,
            end_date: signCheckerSchema.tl1[tl1Index].end_date,
            is_tl_1: true,
            is_tl_2: null,
            is_gl: null,
            is_sh: null,
        })
    }

    for (let tl2Index = 0; tl2Index < signCheckerSchema.tl2.length; tl2Index++)
    {
        signCheckersTemp.push({
            main_schedule_id: mainScheduleId,
            uuid: uuid(),
            start_date: signCheckerSchema.tl2[tl2Index].start_date,
            end_date: signCheckerSchema.tl2[tl2Index].end_date,
            is_tl_1: null,
            is_tl_2: true,
            is_gl: null,
            is_sh: null,
        })
    }

    for (let glIndex = 0; glIndex < signCheckerSchema.gl.length; glIndex++)
    {
        signCheckersTemp.push({
            main_schedule_id: mainScheduleId,
            uuid: uuid(),
            start_date: signCheckerSchema.gl[glIndex].start_date,
            end_date: signCheckerSchema.gl[glIndex].end_date,
            is_tl_1: null,
            is_tl_2: null,
            is_gl: true,
            is_sh: null,
        })
    }

    for (let shIndex = 0; shIndex < signCheckerSchema.sh.length; shIndex++)
    {
        signCheckersTemp.push({
            main_schedule_id: mainScheduleId,
            uuid: uuid(),
            start_date: signCheckerSchema.sh[shIndex].start_date,
            end_date: signCheckerSchema.sh[shIndex].end_date,
            is_tl_1: null,
            is_tl_2: null,
            is_gl: null,
            is_sh: true,
        })
    }

    const schema = await bulkToSchema(signCheckersTemp)
    return schema
}


const clear4sTransactionRows = async (flagCreatedBy) => {
    if (flagCreatedBy)
    {
        console.log('clearing start')

        await database.query(`DELETE FROM ${table.tb_r_4s_schedule_sign_checkers} WHERE created_by = '${flagCreatedBy}'`)
        const lastTransSignChecker = await database.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_4s_schedule_sign_checkers} ORDER BY sign_checker_id DESC LIMIT 1`)
        await database.query(`ALTER TABLE ${table.tb_r_4s_schedule_sign_checkers} ALTER COLUMN sign_checker_id RESTART WITH ${(lastTransSignChecker.rows[0]?.sign_checker_id ?? 0) + 1}`)

        await database.query(`DELETE FROM ${table.tb_r_4s_sub_schedules} WHERE created_by = '${flagCreatedBy}'`)
        const lastTransSubSchedule = await database.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_4s_sub_schedules} ORDER BY sub_schedule_id DESC LIMIT 1`)
        await database.query(`ALTER TABLE ${table.tb_r_4s_sub_schedules} ALTER COLUMN sub_schedule_id RESTART WITH ${(lastTransSubSchedule.rows[0]?.sub_schedule_id ?? 0) + 1}`)

        await database.query(`DELETE FROM ${table.tb_r_4s_main_schedules} WHERE created_by = '${flagCreatedBy}'`)
        const lastTransMainSchedule = await database.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_4s_main_schedules} ORDER BY main_schedule_id DESC LIMIT 1`)
        await database.query(`ALTER TABLE ${table.tb_r_4s_main_schedules} ALTER COLUMN main_schedule_id RESTART WITH ${(lastTransMainSchedule.rows[0]?.main_schedule_id ?? 0) + 1}`)

        console.log('clearing succeed')
    }
}

/**
 * 
 * @param {databasePool} db 
 * @param {number} lineId 
 * @param {number} groupId 
 * @param {number} precitionVal 
 * @param {number} freqId 
 * @param {number} zoneId 
 * @param {number} kanbanId 
 * @param {number} monthNum 
 * @param {number} yearNum 
 * @param {Array<Any>|null>} shiftRows 
 */
const createNewKanbanSingleLineSchedule = async (
    db,
    lineId,
    groupId,
    precitionVal,
    freqId,
    zoneId,
    kanbanId,
    monthNum = 0,
    yearNum = 0,
    shiftRows = [],
    flagInsertBy = ''
) => {
    try
    {
        if (!db)
        {
            db = database
        }

        const find = await findScheduleTransaction4S(
            yearNum,
            monthNum,
            lineId,
            groupId
        )

        let mainScheduleData = null

        if (!find || find.length == 0)
        {
            const mainScheduleSql = `insert into ${table.tb_r_4s_main_schedules}
            (uuid, month_num, year_num, line_id, group_id) 
            values 
            ('${uuid()}', ${monthNum}, ${yearNum}, ${lineId}, ${groupId}) returning *`
            console.log('mainScheduleSql', mainScheduleSql);

            mainScheduleData = await db.query(mainScheduleSql)
            mainScheduleData = mainScheduleData.rows[0]
        }
        else
        {
            mainScheduleData = await db.query(`select * from ${table.tb_r_4s_main_schedules} where main_schedule_id = '${find[0].main_schedule_id}'`)
            mainScheduleData = mainScheduleData.rows[0]
        }

        if (!shiftRows || shiftRows.length == 0)
        {
            if (lineId == 8 || lineId == 9)
            {
                shiftRows = await shiftByGroupId(
                    yearNum,
                    monthNum,
                    lineId,
                    groupId
                )
            }
            else
            {
                shiftRows = await nonShift(
                    yearNum,
                    monthNum
                )
            }
        }

        const lineGroup = {
            line_id: lineId,
            group_id: groupId,
        }

        //#region sub_schedule inserted
        {
            const subSchedule = await mapSchemaPlanKanban4S(
                lineId,
                groupId,
                precitionVal,
                freqId,
                zoneId,
                kanbanId,
                monthNum,
                yearNum,
                shiftRows,
                true
            )

            if (subSchedule.length > 0)
            {
                let subScheduleTemp = []
                for (let i = 0; i < subSchedule.length; i++)
                {
                    subScheduleTemp.push({
                        uuid: uuid(),
                        main_schedule_id: mainScheduleData.main_schedule_id,
                        kanban_id: subSchedule[i].kanban_id,
                        zone_id: subSchedule[i].zone_id,
                        freq_id: subSchedule[i].freq_id,
                        schedule_id: subSchedule[i].schedule_id,
                        shift_type: lineId == 8 || lineId == 9 ? subSchedule[i].shift_type : null,
                        plan_time: subSchedule[i].plan_time,
                        is_holiday: subSchedule[i].is_holiday,
                        created_by: flagInsertBy ? flagInsertBy : 'GENERATED',
                    })
                }

                if (subScheduleTemp.length > 0)
                {
                    const subSchema = await bulkToSchema(subScheduleTemp)
                    const sqlInSub = `insert into ${table.tb_r_4s_sub_schedules} (${subSchema.columns}) values ${subSchema.values}`
                    console.log('sqlInSub', sqlInSub);
                    await db.query(sqlInSub)
                }
            }
        }
        //#endregion

        //#region sign_checker inserted
        {
            const signCheckers = await genMonthlySignCheckerSchema(
                yearNum,
                monthNum,
                lineGroup,
                shiftRows
            )

            const signCheckersTemp = []

            const signCheckerTl1 = signCheckers.tl1
            if (signCheckerTl1.length > 0)
            {
                for (let i = 0; i < signCheckerTl1.length; i++)
                {
                    signCheckersTemp.push({
                        main_schedule_id: mainScheduleData.main_schedule_id,
                        uuid: uuid(),
                        start_date: signCheckerTl1[i].start_date,
                        end_date: signCheckerTl1[i].end_date,
                        is_tl_1: true,
                        is_tl_2: null,
                        is_gl: null,
                        is_sh: null,
                        created_by: flagInsertBy ? flagInsertBy : 'GENERATED',
                    })
                }
            }

            const signCheckerTl2 = signCheckers.tl2
            if (signCheckerTl2.length > 0)
            {
                for (let i = 0; i < signCheckerTl2.length; i++)
                {
                    signCheckersTemp.push({
                        main_schedule_id: mainScheduleData.main_schedule_id,
                        uuid: uuid(),
                        start_date: signCheckerTl2[i].start_date,
                        end_date: signCheckerTl2[i].end_date,
                        is_tl_1: null,
                        is_tl_2: true,
                        is_gl: null,
                        is_sh: null,
                        created_by: flagInsertBy ? flagInsertBy : 'GENERATED',
                    })
                }
            }

            const signChckerGl = signCheckers.gl
            if (signChckerGl.length > 0)
            {
                for (let i = 0; i < signChckerGl.length; i++)
                {
                    signCheckersTemp.push({
                        main_schedule_id: mainScheduleData.main_schedule_id,
                        uuid: uuid(),
                        start_date: signChckerGl[i].start_date,
                        end_date: signChckerGl[i].end_date,
                        is_tl_1: null,
                        is_tl_2: null,
                        is_gl: true,
                        is_sh: null,
                        created_by: flagInsertBy ? flagInsertBy : 'GENERATED',
                    })
                }
            }

            const signChckerSh = signCheckers.sh
            if (signChckerSh.length > 0)
            {
                for (let i = 0; i < signChckerSh.length; i++)
                {
                    signCheckersTemp.push({
                        main_schedule_id: mainScheduleData.main_schedule_id,
                        uuid: uuid(),
                        start_date: signChckerSh[i].start_date,
                        end_date: signChckerSh[i].end_date,
                        is_tl_1: null,
                        is_tl_2: null,
                        is_gl: null,
                        is_sh: true,
                        created_by: flagInsertBy ? flagInsertBy : 'GENERATED',
                    })
                }
            }

            if (signCheckersTemp.length > 0)
            {
                const sgSchema = await bulkToSchema(signCheckersTemp)
                const sqlInSign = `insert into ${table.tb_r_4s_schedule_sign_checkers} (${sgSchema.columns}) values ${sgSchema.values}`
                console.log('sqlInSign', sqlInSign);
                await db.query(sqlInSign)
            }
        }

        //#endregion
    }
    catch (e)
    {
        throw e
    }
}

module.exports = {
    findScheduleTransaction4S: findScheduleTransaction4S,
    findSignCheckerTransaction4S: findSignCheckerTransaction4S,
    genSingleMonthlySubScheduleSchema: genSingleMonthlySubScheduleSchema,
    genMonthlySubScheduleSchema: genMonthlySubScheduleSchema,
    genMonthlySignCheckerSchema: genMonthlySignCheckerSchema,
    genSingleSignCheckerSqlFromSchema: genSingleSignCheckerSqlFromSchema,
    clear4sTransactionRows: clear4sTransactionRows,
    mapSchemaPlanKanban4S: mapSchemaPlanKanban4S,
    createNewKanbanSingleLineSchedule: createNewKanbanSingleLineSchedule
}