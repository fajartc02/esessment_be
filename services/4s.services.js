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

const { databasePool } = require('../config/database')
const pg = require('pg')
const table = require('../config/table')
const moment = require('moment')
const { getRandomInt } = require('../helpers/formatting')
const { bulkToSchema } = require('../helpers/schema')
const { uuid } = require('uuidv4')

const dateFormatted = (date = '') => (moment(date, 'YYYY-MM-DD').format('YYYY-MM-DD'))


/**
 * function genSingleMonthlySubScheduleSchema
 * 
 * @param {kanbamRows} kanbanRow 
 * @param {lineGroup} lineGroup 
 * @param {Array<*>} shiftRows 
 * @param {string} planTime 
 * @returns {Array<*>}
 */
const genSingleMonthlySubScheduleSchema = (kanbanRow, lineGroup, shiftRows = [], planTime = '') => {
    const result = []
    for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
    {
        result.push({
            uuid: uuid(),
            main_schedule_id: kanbanRow.main_schedule_id,
            // group_id: lineGroup.group_id,
            // line_id: lineGroup.line_id,
            kanban_id: kanbanRow.kanban_id,
            zone_id: kanbanRow.zone_id,
            freq_id: kanbanRow.freq_id,
            schedule_id: shiftRows[sIndex].schedule_id,
            shift_type: shiftRows[sIndex].shift_type,
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
const genMonthlySignCheckerSchema = async (currentYear, currentMonth, lineGroup, shiftRows = []) => {
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
const genMonthlySubScheduleSchema = async (currentYear, currentMonth, lineGroup, shiftRows = []) => {
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
                where 
                    tmz.line_id = ${lineGroup.line_id}
                    and tmk.group_id = ${lineGroup.group_id}
                order by
                    tmk.group_id
            `)

    const kanbanRows = kanbanQuery.rows
    if (kanbanRows.length == 0)
    {
        return result
    }
    //#endregion
    {
        let countSame = 0 // determine steps pattern
        let lastWeekNum = 0
        for (let kIndex = 0; kIndex < kanbanRows.length; kIndex++)
        {
            let planTime = null
            let shouldPlan = false
            //lastWeekNum = 0

            // >= 1 MONTH 
            if (kanbanRows[kIndex].precition_val >= 30)
            {
                const lastPlanTimeQuery = await databasePool.query(
                    `
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
                            and tms.date = '${currentYear}-${currentMonth}-01'::date - interval '${kanbanRows[kIndex].precition_val} days'
                        order by
                            trss.sub_schedule_id desc 
                        limit 1
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
                        kanbanRows[kIndex].precition_val == 30
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
                    //#region check validaty of kanban precition_val should plan if not already exists 
                    const scheduleExists = await databasePool.query(
                        `
                            select 
                                count(*) as count
                            from 
                                ${table.tb_r_4s_sub_schedules}  
                            where 
                                kanban_id = '${kanbanRows[kIndex].kanban_id}'
                                and zone_id = '${kanbanRows[kIndex].zone_id}'
                                and freq_id = '${kanbanRows[kIndex].freq_id}'
                        `
                    )
                    if (scheduleExists.rows && scheduleExists.rows.length > 0 && scheduleExists.rows[0].count > 0)
                    {
                        continue
                    }
                    //#endregion

                    shouldPlan = true
                    if (
                        kanbanRows[kIndex].precition_val == 30
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
            if (kanbanRows[kIndex].precition_val == 1)
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

                    const exists = result.find((item) =>
                        item.group_id == lineGroup.group_id
                        && item.line_id == lineGroup.line_id
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
                        group_id: lineGroup.group_id,
                        line_id: lineGroup.line_id,
                        kanban_id: kanbanRows[kIndex].kanban_id,
                        zone_id: kanbanRows[kIndex].zone_id,
                        freq_id: kanbanRows[kIndex].freq_id,
                        schedule_id: shiftRows[sIndex].schedule_id,
                        shift_type: shiftRows[sIndex].shift_type,
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
                if (shouldPlan && kanbanRows[kIndex].precition_val == 7)
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
                        if (shiftRows[sIndex].shift_type == 'morning_shift')
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
                                const byDowSql =
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
                                                date_part('week', tmsc."date") = ${shiftRows[sIndex].week_num}
                                                and date_part('month', tmsc."date") = ${currentMonth}
                                            order by 
                                                tmsc.date
                                    `

                                //console.log('countSame placed', countSame);
                                //console.log('byDowSql', byDowSql);
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
                                }

                                lastWeekNum = shiftRows[sIndex].week_num
                            }

                            if (lastWeekNum == 0)
                            {
                                lastWeekNum = shiftRows[sIndex].week_num
                            }
                        }
                    }

                    countSame++
                }

                if (kanbanRows[kIndex].precition_val >= 30)
                {
                    const morningShift = shiftRows.filter((item) => {
                        if (kanbanRows[kIndex].precition_val == 30)
                        {
                            return item.is_holiday_schedule
                        }

                        return item.shift_type == 'morning_shift'
                    });

                    planTime = morningShift[getRandomInt(0, morningShift.length - 1)].date;
                }

                if (kanbanRows[kIndex].precition_val == 7)
                {
                    console.log('totalplantimeweek', planTimeWeeklyArr);
                }

                for (let sIndex = 0; sIndex < shiftRows.length; sIndex++)
                {
                    if (kanbanRows[kIndex].precition_val == 7)
                    {
                        planTime = planTimeWeeklyArr.find((item) => item == dateFormatted(shiftRows[sIndex].date))
                        /* if (
                            planTime == dateFormatted(shiftRows[sIndex].date)
                            && shiftRows[sIndex].shift_type == 'night_shift'
                        )
                        {
                            const morningShift = shiftRows.filter((item) => {
                                return item.shift_type == 'morning_shift' && item.week_num == shiftRows[sIndex].week_num
                            });
 
                            planTime = morningShift[getRandomInt(0, morningShift.length - 1)].date;
                        } */
                    }

                    const exists = result.find((item) =>
                        item.group_id == shiftRows[sIndex].group_id
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
                        group_id: lineGroup.group_id,
                        line_id: lineGroup.line_id,
                        kanban_id: kanbanRows[kIndex].kanban_id,
                        zone_id: kanbanRows[kIndex].zone_id,
                        freq_id: kanbanRows[kIndex].freq_id,
                        schedule_id: shiftRows[sIndex].schedule_id,
                        shift_type: shiftRows[sIndex].shift_type,
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

module.exports = {
    genSingleMonthlySubScheduleSchema: genSingleMonthlySubScheduleSchema,
    genMonthlySubScheduleSchema: genMonthlySubScheduleSchema,
    genMonthlySignCheckerSchema: genMonthlySignCheckerSchema,
    /**
     * 
     * @param {signChecker} signCheckerSchema 
     * @returns {Object}
     */
    singleSignCheckerSqlFromSchema: async (currentYear, currentMonth, lineGroup, shiftRows = [], mainScheduleId) => {
        const signCheckerSchema = await genMonthlySignCheckerSchema(currentYear, currentMonth, lineGroup, shiftRows)
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
}