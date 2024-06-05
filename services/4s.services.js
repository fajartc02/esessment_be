const { databasePool } = require('../config/database')
const pg = require('pg')
const table = require('../config/table')


module.exports = {
    /**
     * function shiftByGroupId
     * 
     * @param {number} currentYear 
     * @param {number} currentMonth 
     * @param {number} line_id 
     * @param {number} group_id 
     * @returns {Promise<Array<*>>} []
     */
    shiftByGroupId: async (currentYear, currentMonth, line_id, group_id) => {
        //#region scheduler shiftSql
        const shiftSql =
            `
            with
                shifts as (
                            select distinct on
                                (
                                tmsh.group_id,
                                tms1.date
                                )
                                tms1.schedule_id,
                                tms1.date,
                                tmsh.group_id,
                                date_part('week', date::date) as week_num,
                                tms1.is_holiday as is_holiday_schedule,
                                shift_holiday.is_holiday or tms1.is_holiday as is_holiday,
                                case
                                    when shift_holiday.is_holiday or tms1.is_holiday then null
                                    when tmsh.shift_type is not null then tmsh.shift_type
                                    when tmsh.shift_type is null and date_part('week', date::date)::integer % 2 = 0
                                        then 'morning_shift'
                                    else 'night_shift'
                                    end                       as shift_type
                            from
                                tb_m_schedules tms1
                                    left join tb_m_shifts tmsh
                                                on tms1.date between tmsh.start_date and tmsh.end_date and tmsh.group_id = ${group_id}
                                    left join tb_m_shifts shift_holiday on
                                        tms1.date between shift_holiday.start_date and shift_holiday.end_date
                                        and shift_holiday.is_holiday = true
                            where
                                    date_part('month', tms1.date) = ${currentMonth}
                                and date_part('year', tms1.date) = ${currentYear}
                            order by
                                group_id, date, shift_type
                        ),
                schedules as (
                                select distinct on (shifts.group_id, shifts.date)
                                    '${line_id}'as line_id,
                                    shifts.group_id,
                                    shifts.schedule_id,
                                    shifts.week_num,
                                    shifts.date,
                                    to_char(shifts.date::date, 'dd') as date_num,
                                    shifts.shift_type,
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
                                    shifts.date, shifts.group_id
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
        //logger.log('info', shiftSql)
        const shiftQuery = await databasePool.query(shiftSql)
        return shiftQuery.rows
    },
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
    genMonthlySubScheduleSchema: async (currentYear, currentMonth, lineGroup, shiftRows = []) => {
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
}