const { databasePool, database } = require('../config/database')
const pg = require('pg')
const table = require('../config/table')
const moment = require('moment')

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
        const shiftQuery = await database.query(shiftSql)
        return shiftQuery.rows
    },
    /**
     * 
     * @param {number} currentYear 
     * @param {number} currentMonth 
     * @returns {Promise<Array<*>>}
     */
    nonShift: async (currentYear, currentMonth) => {
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
        const shiftQuery = await database.query(shiftSql)
        return shiftQuery.rows
    }
}