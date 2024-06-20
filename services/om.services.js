const pg = require('pg')
const table = require('../config/table')
const moment = require('moment')
const { databasePool } = require('../config/database')
const { getRandomInt, padTwoDigits } = require('../helpers/formatting')
const { bulkToSchema } = require('../helpers/schema')
const { uuid } = require('uuidv4')
const { nonShift } = require('./shift.services')

const dateFormatted = (date = '') => (moment(date, 'YYYY-MM-DD').format('YYYY-MM-DD'))

const baseMstScheduleQueryOM = async (
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

const findScheduleTransactionOM = async (
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
        filterMain.push(`tr4sms.line_id = ${lineId}`)
    }
    if (groupId)
    {
        filterMain.push(`tr4sms.group_id = ${groupId}`)
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

    const query = await databasePool.query(sql)
    if (query && query.rowCount > 0)
    {
        return query.rows
    }

    return null
}

const findSignCheckerTransactionOM = async (
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

    //console.log('sql sign checker', sql);
    const query = await databasePool.query(sql)
    if (query && query.rowCount > 0)
    {
        return query.rows
    }

    return null
}

const findSingleLastPlanTimeOM = async (
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
    const lastPlanTimeQuery = await databasePool.query(lastPlanTimeSql)

    if (lastPlanTimeQuery && lastPlanTimeQuery.rowCount > 0)
    {
        return lastPlanTimeQuery.rows[0]
    }

    return null
}

const genDailySchedulePlan = async (
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
                main_schedule_id: null,
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
    itemCheckKanbanRow = {},
    shiftRows = [],
    monthNum,
    yearNum,
    lineId,
    groupId,
    shouldGeneratePlan = true
) => {
    const result = []

    if (itemCheckKanbanRow.precition_val >= 7)
    {
        if (!shiftRows || shiftRows.length == 0)
        {
            shiftRows = await nonShift(
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
            let planTime = planTimeWeeklyArr.find((item) => item == dateFormatted(shiftRows[sIndex].date))

            result.push({
                main_schedule_id: null,
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
                yearNum,
                monthNum
            )
        }

        let planTime = null
        if (shouldGeneratePlan)
        {
            const lastPlanTime = await findSingleLastPlanTimeOM(
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
                                                tross.kanban_id = '${itemCheckKanbanRow.kanban_id}'
                                                and tross.machine_id = '${itemCheckKanbanRow.machine_id}'
                                                and tross.freq_id = '${itemCheckKanbanRow.freq_id}'`

                const scheduleExists = await databasePool.query(scheduleExistsSql)
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
                main_schedule_id: null,
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
            yearNum,
            monthNum
        )
    }

    const itemCheckKanbanRow = {
        precition_val: precition_val,
        kanban_id: itemCheckKanbanId,
        freq_id: freqId,
        machine_id: machineId,
    }

    const monthly = await genMonthlySchedulePlan(
        itemCheckKanbanRow,
        shiftRows,
        lineId,
        groupId,
        monthNum,
        yearNum,
        shouldGeneratePlan
    )

    const weekly = await genWeeklySchedulePlan(
        itemCheckKanbanRow,
        shiftRows,
        monthNum,
        yearNum,
        lineId,
        groupId,
        shouldGeneratePlan
    )

    const daily = await genDailySchedulePlan(
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
const genMonthlySubScheduleSchemaOM = async (yearNum, monthNum, lineGroup, shiftRows = []) => {
    const result = []

    //#region scheduler fetch all kanban
    const itemCheckKanbanRows = await baseMstScheduleQueryOM(
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
                yearNum,
                monthNum
            )
        }

        for (let kIndex = 0; kIndex < itemCheckKanbanRows.length; kIndex++)
        {
            const allPlan = await mapSchemaPlanKanbanOM(
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
const genMonthlySignCheckerSchemaOM = async (yearNum, monthNum, lineGroup, shiftRows = []) => {
    const result = {
        tl: [],
        gl: [],
    }

    const find = await findSignCheckerTransactionOM(
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
const singleSignCheckerSqlFromSchemaOM = async (yearNum, monthNum, lineGroup, shiftRows = [], mainScheduleId) => {
    const signCheckerSchema = await genMonthlySignCheckerSchemaOM(yearNum, monthNum, lineGroup, shiftRows)
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
const clearOmTransactionRows = async (flagCreatedBy) => {
    if (flagCreatedBy)
    {
        console.log('clearing start')
        
        await databasePool.query(`DELETE FROM ${table.tb_r_om_sub_schedules} WHERE created_by = '${flagCreatedBy}'`)
        const lastSub = await databasePool.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_om_sub_schedules} ORDER BY om_sub_schedule_id DESC LIMIT 1`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_om_sub_schedules} ALTER COLUMN om_sub_schedule_id RESTART WITH ${(lastSub.rows[0]?.om_sub_schedule_id ?? 0) + 1}`)

        await databasePool.query(`DELETE FROM ${table.tb_r_om_schedule_sign_checkers} WHERE created_by = '${flagCreatedBy}'`)
        const lastSignChecker = await databasePool.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_om_schedule_sign_checkers} ORDER BY om_sign_checker_id DESC LIMIT 1`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_om_schedule_sign_checkers} ALTER COLUMN om_sign_checker_id RESTART WITH ${(lastSignChecker.rows[0]?.om_sign_checker_id ?? 0) + 1}`)

        await databasePool.query(`DELETE FROM ${table.tb_r_om_main_schedules} WHERE created_by = '${flagCreatedBy}'`)
        const lastMain = await databasePool.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_om_main_schedules} ORDER BY om_main_schedule_id DESC LIMIT 1`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_om_main_schedules} ALTER COLUMN om_main_schedule_id RESTART WITH ${(lastMain.rows[0]?.om_main_schedule_id ?? 0) + 1}`)

        console.log('clearing succeed')
    }
}
//#endregion

module.exports = {
    findScheduleTransactionOM: findScheduleTransactionOM,
    findSignCheckerTransactionOM: findSignCheckerTransactionOM,
    genMonthlySubScheduleSchemaOM: genMonthlySubScheduleSchemaOM,
    genMonthlySignCheckerSchemaOM: genMonthlySignCheckerSchemaOM,
    genSingleMonthlySubScheduleSchemaOM: genSingleMonthlySubScheduleSchemaOM,
    singleSignCheckerSqlFromSchemaOM: singleSignCheckerSqlFromSchemaOM,
    clearOmTransactionRows: clearOmTransactionRows
}