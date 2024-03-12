const table = require('../../config/table')
const { queryPOST, queryBulkPOST, queryCustom, queryGET, queryPUT } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const idToUuid = require('../../helpers/idToUuid')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const addAttrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const moment = require('moment')
const { holidayRequest } = require('../../helpers/externalRequest')
const { generateMonthlyDates } = require('../../helpers/date')

module.exports = {
    addCleanPlan: async (req, res) => { },
    addCleanSchedule: async (req, res) => { },
    updateCleanSchedule: async (req, res) => { },
    updateCleanChecker: async (req, res) => { },
    deleteCleanPlan: async (req, res) => { },
    getHoliday: async (req, res) => {
        const holidayApi = await holidayRequest(3, 2024)
        const marchDays = generateMonthlyDates(2024, 3)
        const holidatData = holidayApi.data
        const result = []
        for (let i = 0; i < marchDays.length; i++)
        {
            const marchDay = marchDays[i];

            for (let j = 0; j < holidatData.length; j++)
            {
                const holiday = holidatData[j];
                if (marchDay.date == holiday.holiday_date)
                {
                    marchDay.is_holiday = true
                    marchDay.holiday_name = holiday.holiday_name
                    break
                }
            }

            result.push(marchDay)
        }

        response.success(res, 'Success to get 4s schedules', result)
    },
    get4sPlans: async (req, res) => {
        try
        {
            const { freq, line, zone, kanban } = req.query

            const whereCondt = {}

            const planQuery = await queryCustom(`
                select 
                    trcp.uuid as plan_id,
                    tml.uuid as line_id,
                    tmg.uuid  as group_id,
                    trcp."year",
                    trcp."month",
                    v4m.section_head_nm,
                    v4m.line_head_nm,
                    v4m.team_leader_nm,
                    trcp.section_head_sign,
                    trcp.line_head_sign,
                    trcp.team_leader_sign,
                    tml.line_nm,
                    tmg.group_nm
                from
                    tb_r_4s_plans trcp
                    join tb_m_lines tml on trcp.line_id = tml.line_id
                    join tb_m_groups tmg on trcp.group_id = tmg.group_id
                    left join lateral  (
                        select 
                            *
                        from
                            (select fullname as section_head_nm from v_4s_members where member_4s_id = trcp.section_head_id) a,
                            (select fullname as line_head_nm from v_4s_members where member_4s_id = trcp.line_head_id) b,
                            (select fullname as team_leader_nm from v_4s_members where member_4s_id = trcp.team_leader_id) c
                    ) v4m on true
                where 
                    1 = 1
            `)

            const result = await Promise.all(planQuery.rows)
            response.success(res, 'Success to get 4s plan', result)
        } catch (error)
        {
            console.log(error);
            response.failed(res, 'Error to get 4s plan')
        }
    },
    get4sSchedules: async (req, res) => {
        try
        {
            const { plan_id } = req.query

            const scheduleQuery = await queryCustom(`
                select distinct on (tbrcs.kanban_id)
                    tbrcs.uuid as schedule_id,
                    tm4m.uuid as pic_id,
                    tmk.uuid as kanban_id,
                    tmz.uuid as zone_id,
                    tmf.uuid as freq_id,
                    trcsr.is_daily_to_weekly,
                    trcsr.is_weekly_to_monthly,
                    tmz.zone_nm,
                    tmk.kanban_nm,
                    tmk.area_nm,
                    tmu.fullname as pic_nm,
                    tmf.freq_nm
                from
                    ${table.tb_r_4s_schedules} tbrcs
                    join ${table.tb_m_4s_members} tm4m on tbrcs.pic_id = tm4m.member_4s_id
                    join ${table.tb_m_users} tmu on tm4m.user_id = tmu.user_id
                    join ${table.tb_m_kanbans} tmk on tbrcs.kanban_id = tbrcs.kanban_id
                    join ${table.tb_m_zones} tmz on tbrcs.zone_id = tmz.zone_id
                    join ${table.tb_m_freqs} tmf on tbrcs.freq_id = tmf.freq_id
                    join ${table.tb_m_schedules} tmsc on tbrcs.schedule_id = tmsc.schedule_id
                    left join lateral (
                        select
                            case 
                                when freq_nm = 'Daily' and tmf.freq_nm = 'Weekly' then
                                    true
                                else 
                                    false
                            end as is_daily_to_weekly,
                            case 
                                when freq_nm = 'Weekly' and tmf.freq_nm = 'Monthly' then
                                    true
                                else 
                                    false
                            end as is_weekly_to_monthly
                        from
                            ${table.tb_r_4s_revisions} 
                        where
                            schedule_4s_id = tbrcs.schedule_4s_id
                        order by
                            revision_4s_id desc 
                        limit 1
                    ) trcsr on true
                where
                    tbrcs.plan_4s_id = (select plan_4s_id from ${table.tb_r_4s_plans} where uuid = '${plan_id}')
        `)

            const scheduleRows = scheduleQuery.rows.map(async (item) => {
                const countRowSpanQuery = await queryCustom(`
                with
                    pics as (
                        select
                            count(distinct kanban_id)::integer as pic_rows
                        from
                            ${table.tb_r_4s_schedules}
                        where
                            pic_id = (select member_4s_id from ${table.tb_m_4s_members} where uuid = '${item.pic_id}' limit 1)
                        group by
                            pic_id
                    ),
                    zones as (
                        select
                            count(distinct kanban_id)::integer as zone_rows
                        from
                            ${table.tb_r_4s_schedules}
                        where
                            zone_id = (select zone_id from ${table.tb_m_zones} where uuid = '${item.zone_id}' limit 1)
                        group by
                            zone_id
                    ),
                    freqs as (
                        select
                            count(distinct kanban_id)::integer as freq_rows
                        from
                            ${table.tb_r_4s_schedules}
                        where
                            freq_id = (select freq_id from ${table.tb_m_freqs} where uuid = '${item.freq_id}' limit 1)
                        group by
                            freq_id
                    )
                    select * from pics, zones, freqs
            `)
                const countRows = countRowSpanQuery.rows[0]

                const children = await queryCustom(`
                    select
                        trcs.uuid as schedule_id,
                        EXTRACT('Day' FROM tmsc.date)::INTEGER as date_num,
                        trcs.status,
                        tmsc.is_holiday,
                        trcc.sign
                    from
                        ${table.tb_r_4s_schedules} trcs
                        left join ${table.tb_r_4s_checkers} trcc on trcs.plan_4s_id = trcc.plan_4s_id and is_gl = true  
                        left join ${table.tb_m_schedules} tmsc on trcs.schedule_id = tmsc.schedule_id
                    where
                        trcs.plan_4s_id = (select plan_4s_id from ${table.tb_r_4s_plans} where uuid = '${plan_id}')
                        and trcs.pic_id = (select member_4s_id from ${table.tb_m_4s_members} where uuid = '${item.pic_id}' limit 1)
                        and trcs.freq_id = (select freq_id from ${table.tb_m_freqs} where uuid = '${item.freq_id}' limit 1)
            `)

                item.row_span_pic = countRows.pic_rows
                item.row_span_freq = countRows.freq_rows
                item.row_span_zone = countRows.zone_rows
                item.is_daily_to_weekly = item.is_daily_to_weekly ?? false
                item.is_weekly_to_monthly = item.is_weekly_to_monthly ?? false
                item.children = children.rows

                return item
            })

            const planDateQuery = await queryCustom(`
                select 
                    EXTRACT(MONTH FROM TO_DATE(month, 'TMMonth')) as month_num,
                    year
                from
                    ${table.tb_r_4s_plans} 
                where
                    uuid = '${plan_id}'
            `)
            const planDateRow = planDateQuery.rows[0]


            const signCheckerQuery = await queryCustom(`
                select 
                    date_part('week', "date"::date) AS weekly,
                    count(distinct "date")::integer as col_span
                from 
                    ${table.tb_m_schedules}
                where
                    date_part('month', "date") = '${planDateRow.month_num}'
                    and date_part('year', "date") = '${planDateRow.year}'
                    and (is_holiday is null or is_holiday = false)
                group by 
                    weekly
                order by 
                    weekly
            `)

            const resultScheduleRows = await Promise.all(scheduleRows)
            const result = {
                schedule: resultScheduleRows,
                sign_checker: signCheckerQuery.rows,
            }
            response.success(res, 'Success to get 4s schedule', result)
        } catch (error)
        {
            console.log(error);
            response.failed(res, 'Error to get 4s schedule')
        }
    },
    get4sSignCheckers: async (req, res) => {
        try
        {
            const { plan_id } = req.query

            const checkerQuery = await queryCustom(`
            `)

            const result = await Promise.all(checkerQuery)
            response.success(res, 'Success to get 4s checker', result)
        } catch (error)
        {
            console.log(error);
            response.failed(res, 'Error to get 4s plans')
        }
    }
}