const pg = require('pg')
const table = require('../config/table')
const moment = require('moment')
const { getRandomInt, padTwoDigits } = require('../helpers/formatting')
const { bulkToSchema } = require('../helpers/schema')
const { uuid } = require('uuidv4')
const { nonShift } = require('./shift.services')

const dateFormatted = (date = '') => (moment(date, 'YYYY-MM-DD').format('YYYY-MM-DD'))

const baseMstScheduleQueryOM = async (
    db,
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

    const kanbanQuery = await db.query(mstSql)
    return kanbanQuery.rows
}

const findScheduleTransactionOM = async (
    db,
    year,
    month,
    lineId = null,
    groupId = null,
    freqId = null,
    machineId = null,
    itemCheckKanbanId = null,
    scheduleId = null
) => {
    const filterMain = []
    const filterSub = []

    if (lineId)
    {
        filterMain.push(`troms.line_id = ${lineId}`)
    }
    if (groupId)
    {
        filterMain.push(`troms.group_id = ${groupId}`)
    }

    if (freqId)
    {
        filterSub.push(`tross.freq_id = ${freqId}`)
    }
    if (machineId)
    {
        filterSub.push(`tross.machine_id = ${machineId}`)
    }
    if (itemCheckKanbanId)
    {
        filterSub.push(`tross.om_item_check_kanban_id = ${itemCheckKanbanId}`)
    }
    if (scheduleId)
    {
        filterSub.push(`tross.schedule_id = ${scheduleId}`)
    }

    const joinSub = `left join tb_r_om_sub_schedules tross on troms.om_main_schedule_id = tross.om_main_schedule_id
                        left join tb_m_machines tmm on tross.machine_id = tmm.machine_id
                        left join tb_m_freqs tmf on tross.freq_id = tmf.freq_id
                        left join tb_m_schedules tms on tross.schedule_id = tms.schedule_id`

    const selectSub = `tmf.freq_id, tmm.machine_id, tms.schedule_id, tms.date, tross.plan_time, tross.actual_time, tmf.precition_val`

    const sql = `select
                    troms.om_main_schedule_id,
                    troms.line_id,
                    troms.group_id
                    ${filterSub.length > 0 ? `, ${selectSub}` : ''}
                from
                    tb_r_om_main_schedules troms
                    ${filterSub.length > 0 ? joinSub : ''}
                where
                    troms.month_num = ${month}
                    and troms.year_num = ${year}
                    and troms.deleted_dt is null
                    ${filterMain.length > 0 ? 'and ' + filterMain.join(' and ') : ''}
                    ${filterSub.length > 0 ? 'and ' + filterSub.join(' and ') : ''}`
    //console.log('findScheduleTransactionOM', sql)
    const query = await db.query(sql)
    if (query && query.rowCount > 0)
    {
        return query.rows
    }

    return null
}

const findSignCheckerTransactionOM = async (
    db,
    year,
    month,
    lineId,
    groupId,
    startDate = null,
    endDate = null,
    isTl = null,
    isGl = null
) => {
    let sql = `select
                    troms.om_main_schedule_id
                from
                    tb_r_om_main_schedules troms
                    join tb_r_om_schedule_sign_checkers trossc on troms.om_main_schedule_id = trossc.om_main_schedule_id
                where
                    troms.month_num = ${month}
                    and troms.year_num = ${year}
                    and troms.line_id = ${lineId}
                    and troms.group_id = ${groupId}`

    if (startDate)
    {
        sql += ` and trossc.start_date = '${startDate}'`
    }
    if (endDate)
    {
        sql += ` and trossc.end_date = '${endDate}'`
    }
    if (isTl)
    {
        sql += ` and trossc.is_tl = true`
    }
    if (isGl)
    {
        sql += ` and trossc.is_gl = true`
    }

    //console.log('findSignCheckerTransactionOM', sql);
    const query = await db.query(sql)
    if (query && query.rowCount > 0)
    {
        return query.rows
    }

    return null
}

const findSingleLastPlanTimeOM = async (
    db,
    yearNum,
    monthNum,
    itemCheckKanbanId,
    machineId,
    freqId,
    precitionVal
) => {
    const lastPlanTimeSql = `select
                                tms.date
                            from
                                tb_r_om_sub_schedules tross
                                    join tb_m_om_item_check_kanbans tmoick on tross.om_item_check_kanban_id = tmoick.om_item_check_kanban_id
                                    join tb_m_machines tmm on tross.machine_id = tmm.machine_id
                                    join tb_m_freqs tmf on tross.freq_id = tmf.freq_id
                                    join tb_m_schedules tms on tross.schedule_id = tms.schedule_id
                            where 
                                tross.om_item_check_kanban_id = '${itemCheckKanbanId}'
                                and tross.machine_id = '${machineId}'
                                and tross.freq_id = '${freqId}'
                                and tms.date = '${yearNum}-${padTwoDigits(monthNum)}-01'::date - interval '${precitionVal} days'
                            limit 1`

    //console.log('findSingleLastPlanTimeOM', lastPlanTimeSql);
    const lastPlanTimeQuery = await db.query(lastPlanTimeSql)

    if (lastPlanTimeQuery && lastPlanTimeQuery.rowCount > 0)
    {
        return lastPlanTimeQuery.rows[0]
    }

    return null
}

const genDailySchedulePlan = async (
    db,
    itemCheckKanbanRow = {},
    shiftRows = [],
    monthNum,
    yearNum,
    lineId = 0,
    groupId = 0,
    shouldGeneratePlan = true
) => {
    let result = []
    if (itemCheckKanbanRow.precition_val == 1)
    {
        if (!shiftRows || shiftRows.length == 0)
        {
            shiftRows = await nonShift(
                db,
                yearNum,
                monthNum
            )
        }

        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {
            let planTime = null
            if (!shiftRows[sIndex].is_holiday)
            {
                planTime = dateFormatted(shiftRows[sIndex].date)
            }

            result.push({
                om_main_schedule_id: null,
                group_id: groupId,
                line_id: lineId,
                om_item_check_kanban_id: itemCheckKanbanRow.om_item_check_kanban_id,
                machine_id: itemCheckKanbanRow.machine_id,
                freq_id: itemCheckKanbanRow.freq_id,
                schedule_id: shiftRows[sIndex].schedule_id,
                plan_time: planTime == dateFormatted(shiftRows[sIndex].date) && shouldGeneratePlan ? planTime : null,
                is_holiday: shiftRows[sIndex].is_holiday,
            })
        }
    }

    return result
}

const genWeeklySchedulePlan = async (
    db,
    itemCheckKanbanRow = {},
    shiftRows = [],
    monthNum,
    yearNum,
    lineId,
    groupId,
    shouldGeneratePlan = true
) => {
    const result = []

    if (
        itemCheckKanbanRow.precition_val == 7
        || itemCheckKanbanRow.precition_val == 14
        || itemCheckKanbanRow.precition_val == 21
    )
    {
        if (!shiftRows || shiftRows.length == 0)
        {
            shiftRows = await nonShift(
                db,
                yearNum,
                monthNum,
                lineId,
                groupId
            )
        }

        let planTimeWeeklyArr = []

        if (shouldGeneratePlan)
        {
            const shifts = shiftRows.filter((item) => {
                return !item.is_holiday
            })

            let lastWeekNum = 0

            if (itemCheckKanbanRow.precition_val == 7)
            {
                for (let i = 0; i < shifts.length; i++)
                {
                    if (lastWeekNum != shifts[i].week_num)
                    {
                        const plan = shifts.filter((item) => {
                            return item.week_num == shifts[i].week_num
                        })

                        if (plan.length > 0)
                        {
                            planTimeWeeklyArr.push(dateFormatted(plan[getRandomInt(0, plan.length - 1)].date))
                        } else
                        {
                            planTimeWeeklyArr.push(dateFormatted(shifts[i].date))
                        }

                        lastWeekNum = shifts[i].week_num
                    }
                }
            }
            else if (itemCheckKanbanRow.precition_val == 14)
            {
                const mid = shifts.length - (shifts.length / 2);
                const first = shifts[getRandomInt(0, mid)]
                if (first)
                {
                    planTimeWeeklyArr.push(dateFormatted(first.date))
                }

                const second = shifts[getRandomInt(mid, shifts.length)]
                if (second)
                {
                    planTimeWeeklyArr.push(dateFormatted(second.date))
                }
                else
                {
                    planTimeWeeklyArr.push(dateFormatted(shifts[getRandomInt(0, shifts.length)].date))
                }
            }
            else if (itemCheckKanbanRow.precition_val == 21)
            {
                planTimeWeeklyArr.push(dateFormatted(shifts[getRandomInt(0, shifts.length)].date))
            }

        }

        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {
            let planTime = planTimeWeeklyArr.find((item) => item == dateFormatted(shiftRows[sIndex].date))

            result.push({
                om_main_schedule_id: null,
                group_id: groupId,
                line_id: lineId,
                om_item_check_kanban_id: itemCheckKanbanRow.om_item_check_kanban_id,
                machine_id: itemCheckKanbanRow.machine_id,
                freq_id: itemCheckKanbanRow.freq_id,
                schedule_id: shiftRows[sIndex].schedule_id,
                plan_time: planTime == dateFormatted(shiftRows[sIndex].date) && shouldGeneratePlan ? planTime : null,
                is_holiday: shiftRows[sIndex].is_holiday,
            })
        }
    }

    return result
}

const genMonthlySchedulePlan = async (
    db,
    itemCheckKanbanRow = {},
    shiftRows = [],
    lineId = 0,
    groupId = 0,
    monthNum = 0,
    yearNum = 0,
    shouldGeneratePlan = true
) => {
    const result = []
    if (itemCheckKanbanRow.precition_val >= 30)
    {
        if (!shiftRows || shiftRows.length == 0)
        {
            shiftRows = await nonShift(
                db,
                yearNum,
                monthNum
            )
        }

        let planTime = null
        if (shouldGeneratePlan)
        {
            const lastPlanTime = await findSingleLastPlanTimeOM(
                db,
                yearNum,
                monthNum,
                itemCheckKanbanRow.om_item_check_kanban_id,
                itemCheckKanbanRow.machine_id,
                itemCheckKanbanRow.freq_id,
                itemCheckKanbanRow.precition_val
            )

            if (lastPlanTime)
            {
                planTime = moment(lastPlanTime.date, 'YYYY-MM-DD')
                    .clone()
                    .add(itemCheckKanbanRow.precition_val, 'd')

                //MONTHLY should plan on holiday  
                if (
                    itemCheckKanbanRow.precition_val == 30
                    && moment(planTime).day() != 6
                )
                {
                    planTime = moment(planTime)
                        .clone()
                        .weekday(6)
                }
                //2 MONTH should plan on week day
                else if (itemCheckKanbanRow.precition_val > 30 && moment(planTime).day() == 6 || moment(planTime).day() == 7)
                {
                    planTime = moment(planTime)
                        .clone()
                        .weekday(getRandomInt(0, 5)) // generate random number 0 - 5 for weekday
                }
            }

            if (!planTime && itemCheckKanbanRow.precition_val > 30)
            {
                // determine validity of kanban precition_val should plan if not already exists before (specially for > 1 month)
                //#region existing validity
                const scheduleExistsSql = `select 
                                                tross.schedule_id
                                            from 
                                                ${table.tb_r_om_sub_schedules} tross 
                                                join ${table.tb_m_schedules} tms on tross.schedule_id = tms.schedule_id
                                            where 
                                                tross.om_item_check_kanban_id = '${itemCheckKanbanRow.om_item_check_kanban_id}'
                                                and tross.machine_id = '${itemCheckKanbanRow.machine_id}'
                                                and tross.freq_id = '${itemCheckKanbanRow.freq_id}'`

                const scheduleExists = await db.query(scheduleExistsSql)
                if (scheduleExists.rowCount > 0)
                {
                    return result
                }
                //#endregion
            }

            const morningShift = shiftRows.filter((item) => {
                if (itemCheckKanbanRow.precition_val == 30)
                {
                    return item.is_holiday
                }

                return true
            });

            // need to redefine cause beruratan, tidak like
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
            result.push({
                om_main_schedule_id: null,
                group_id: groupId,
                line_id: lineId,
                om_item_check_kanban_id: itemCheckKanbanRow.om_item_check_kanban_id,
                machine_id: itemCheckKanbanRow.machine_id,
                freq_id: itemCheckKanbanRow.freq_id,
                schedule_id: shiftRows[sIndex].schedule_id,
                plan_time: dateFormatted(planTime) == dateFormatted(shiftRows[sIndex].date) ? planTime : null,
                is_holiday: shiftRows[sIndex].is_holiday,
            })
        }
    }

    return result
}

const mapSchemaPlanKanbanOM = async (
    db,
    lineId,
    groupId,
    precition_val,
    freqId,
    machineId,
    itemCheckKanbanId,
    monthNum = 0,
    yearNum = 0,
    shiftRows = [],
    shouldGeneratePlan = true
) => {
    const result = []

    if (!shiftRows || shiftRows.length == 0)
    {
        shiftRows = await nonShift(
            db,
            yearNum,
            monthNum
        )
    }

    const itemCheckKanbanRow = {
        precition_val: precition_val,
        om_item_check_kanban_id: itemCheckKanbanId,
        freq_id: freqId,
        machine_id: machineId,
    }

    const monthly = await genMonthlySchedulePlan(
        db,
        itemCheckKanbanRow,
        shiftRows,
        lineId,
        groupId,
        monthNum,
        yearNum,
        shouldGeneratePlan
    )

    const weekly = await genWeeklySchedulePlan(
        db,
        itemCheckKanbanRow,
        shiftRows,
        monthNum,
        yearNum,
        lineId,
        groupId,
        shouldGeneratePlan
    )

    const daily = await genDailySchedulePlan(
        db,
        itemCheckKanbanRow,
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
const genMonthlySubScheduleSchemaOM = async (db, yearNum, monthNum, lineGroup, shiftRows = []) => {
    const result = []

    //#region scheduler fetch all kanban
    const itemCheckKanbanRows = await baseMstScheduleQueryOM(
        db,
        lineGroup.line_id,
        lineGroup.group_id
    )

    if (itemCheckKanbanRows.length == 0)
    {
        return result
    }
    //#endregion

    //#region processing sub schedule schema
    {
        if (!shiftRows || (shiftRows?.length ?? 0) == 0)
        {
            shiftRows = await nonShift(
                db,
                yearNum,
                monthNum
            )
        }

        for (let kIndex = 0; kIndex < itemCheckKanbanRows.length; kIndex++)
        {
            const allPlan = await mapSchemaPlanKanbanOM(
                db,
                lineGroup.line_id,
                lineGroup.group_id,
                itemCheckKanbanRows[kIndex].precition_val,
                itemCheckKanbanRows[kIndex].freq_id,
                itemCheckKanbanRows[kIndex].machine_id,
                itemCheckKanbanRows[kIndex].om_item_check_kanban_id,
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
const genMonthlySignCheckerSchemaOM = async (db, yearNum, monthNum, lineGroup, shiftRows = []) => {
    const result = {
        tl: [],
        gl: [],
    }

    const find = await findSignCheckerTransactionOM(
        db,
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

    //#region scheduler generate tl sign checker
    {
        for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
        {
            if (!shiftRows[sIndex].is_holiday)
            {
                result.tl.push({
                    om_main_schedule_id: null,
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
            const glSignQuery = await db.query(glSignSql)

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
                        om_main_schedule_id: null,
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
* @param {signChecker} signCheckerSchema 
* @returns {Object}
*/
const singleSignCheckerSqlFromSchemaOM = async (db, yearNum, monthNum, lineGroup, shiftRows = [], mainScheduleId) => {
    const signCheckerSchema = await genMonthlySignCheckerSchemaOM(db, yearNum, monthNum, lineGroup, shiftRows)
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
const clearOmTransactionRows = async (db, flagCreatedBy) => {
    if (flagCreatedBy)
    {
        console.log('clearing start')

        await db.query(`DELETE FROM ${table.tb_r_om_sub_schedules} WHERE created_by = '${flagCreatedBy}'`)
        const lastSub = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_om_sub_schedules} ORDER BY om_sub_schedule_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_r_om_sub_schedules} ALTER COLUMN om_sub_schedule_id RESTART WITH ${(lastSub.rows[0]?.om_sub_schedule_id ?? 0) + 1}`)

        await db.query(`DELETE FROM ${table.tb_r_om_schedule_sign_checkers} WHERE created_by = '${flagCreatedBy}'`)
        const lastSignChecker = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_om_schedule_sign_checkers} ORDER BY om_sign_checker_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_r_om_schedule_sign_checkers} ALTER COLUMN om_sign_checker_id RESTART WITH ${(lastSignChecker.rows[0]?.om_sign_checker_id ?? 0) + 1}`)

        await db.query(`DELETE FROM ${table.tb_r_om_main_schedules} WHERE created_by = '${flagCreatedBy}'`)
        const lastMain = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_om_main_schedules} ORDER BY om_main_schedule_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_r_om_main_schedules} ALTER COLUMN om_main_schedule_id RESTART WITH ${(lastMain.rows[0]?.om_main_schedule_id ?? 0) + 1}`)

        console.log('clearing succeed')
    }
}
//#endregion

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
    machineId,
    itemCheckId,
    monthNum = 0,
    yearNum = 0,
    shiftRows = [],
    flagInsertBy = ''
) => {
    try
    {
        const find = await findScheduleTransactionOM(
            db,
            yearNum,
            monthNum,
            lineId,
            groupId
        )

        let mainScheduleData = null

        if (!find || find.length == 0)
        {
            const mainScheduleSql = `insert into ${table.tb_r_om_main_schedules}
            (uuid, month_num, year_num, line_id, group_id) 
            values 
            ('${uuid()}', ${monthNum}, ${yearNum}, ${lineId}, ${groupId}) returning *`
            console.log('mainScheduleSql', mainScheduleSql);

            mainScheduleData = await db.query(mainScheduleSql)
            mainScheduleData = mainScheduleData.rows[0]
        }
        else
        {
            mainScheduleData = await db.query(`select * from ${table.tb_r_om_main_schedules} where om_main_schedule_id = '${find[0].om_main_schedule_id}'`)
            mainScheduleData = mainScheduleData.rows[0]
        }

        if (!shiftRows || shiftRows.length == 0)
        {
            shiftRows = await nonShift(
                db,
                yearNum,
                monthNum,
                lineId,
                groupId
            )
        }

        const lineGroup = {
            line_id: lineId,
            group_id: groupId,
        }

        //#region sub_schedule inserted
        {
            const subSchedule = await mapSchemaPlanKanbanOM(
                db,
                lineId,
                groupId,
                precitionVal,
                freqId,
                machineId,
                itemCheckId,
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
                        om_main_schedule_id: mainScheduleData.om_main_schedule_id,
                        om_item_check_kanban_id: subSchedule[i].om_item_check_kanban_id,
                        machine_id: subSchedule[i].machine_id,
                        freq_id: subSchedule[i].freq_id,
                        schedule_id: subSchedule[i].schedule_id,
                        plan_time: subSchedule[i].plan_time,
                        is_holiday: subSchedule[i].is_holiday,
                        created_by: flagInsertBy ? flagInsertBy : 'GENERATED',
                    })
                }

                if (subScheduleTemp.length > 0)
                {
                    const subSchema = await bulkToSchema(subScheduleTemp)
                    const sqlInSub = `insert into ${table.tb_r_om_sub_schedules} (${subSchema.columns}) values ${subSchema.values}`
                    console.log('sqlInSub', sqlInSub);
                    await db.query(sqlInSub)
                }
            }
        }
        //#endregion

        //#region sign_checker inserted
        {
            const signCheckers = await genMonthlySignCheckerSchemaOM(
                db,
                yearNum,
                monthNum,
                lineGroup,
                shiftRows
            )

            const signCheckersTemp = []

            const signCheckerTl1 = signCheckers.tl
            if (signCheckerTl1.length > 0)
            {
                for (let i = 0; i < signCheckerTl1.length; i++)
                {
                    signCheckersTemp.push({
                        om_main_schedule_id: mainScheduleData.om_main_schedule_id,
                        uuid: uuid(),
                        start_date: signCheckerTl1[i].start_date,
                        end_date: signCheckerTl1[i].end_date,
                        is_tl: true,
                        is_gl: null,
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
                        om_main_schedule_id: mainScheduleData.om_main_schedule_id,
                        uuid: uuid(),
                        start_date: signChckerGl[i].start_date,
                        end_date: signChckerGl[i].end_date,
                        is_tl: null,
                        is_gl: true,
                        created_by: flagInsertBy ? flagInsertBy : 'GENERATED',
                    })
                }
            }

            if (signCheckersTemp.length > 0)
            {
                const sgSchema = await bulkToSchema(signCheckersTemp)
                const sqlInSign = `insert into ${table.tb_r_om_schedule_sign_checkers} (${sgSchema.columns}) values ${sgSchema.values}`
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
    findScheduleTransactionOM: findScheduleTransactionOM,
    findSignCheckerTransactionOM: findSignCheckerTransactionOM,
    genMonthlySubScheduleSchemaOM: genMonthlySubScheduleSchemaOM,
    genMonthlySignCheckerSchemaOM: genMonthlySignCheckerSchemaOM,
    genSingleMonthlySubScheduleSchemaOM: genSingleMonthlySubScheduleSchemaOM,
    singleSignCheckerSqlFromSchemaOM: singleSignCheckerSqlFromSchemaOM,
    clearOmTransactionRows: clearOmTransactionRows,
    createNewKanbanSingleLineSchedule
}