const table = require("../../config/table")
const {
    queryCustom,
    queryGET,
    queryPUT,
    queryTransaction,
    queryPutTransaction
} = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const { padTwoDigits } = require("../../helpers/formatting")
const moment = require('moment')
const logger = require('../../helpers/logger')

const fromSubScheduleSql = `
    ${table.tb_r_om_sub_schedules} tross
    join ${table.tb_m_schedules} tmsc on tross.schedule_id = tmsc.schedule_id
    join ${table.tb_m_machines} tmm on tross.machine_id = tmm.machine_id
    join ${table.tb_m_om_item_check_kanbans} tmoic on tross.om_item_check_kanban_id = tmoic.om_item_check_kanban_id
    join ${table.tb_m_freqs} tmf on tross.freq_id = tmf.freq_id
    join ${table.tb_r_om_main_schedules} trmsc on tross.om_main_schedule_id = trmsc.om_main_schedule_id 
    left join ${table.tb_m_users} tmu on tmu.user_id = tross.pic_id
    left join ${table.tb_m_users} tmu_actual on tmu_actual.user_id = tross.actual_pic_id
    join lateral (
      select * from ${table.tb_m_lines} where line_id = trmsc.line_id
    ) tml on true
    join ${table.tb_m_groups} tmg on trmsc.group_id = tmg.group_id
    left join ${table.tb_m_judgments} tmj on tross.judgment_id = tmj.judgment_id
`

const selectSubScheduleCol = [
    'tml.uuid as line_id',
    'tmg.uuid as group_id',
    'tross.om_main_schedule_id',
    'trmsc.uuid as om_main_schedule_uuid',
    'tross.uuid as om_sub_schedule_id',
    'tmoic.uuid as om_item_check_kanban_id',
    'tmm.uuid as machine_id',
    'tmf.uuid as freq_id',
    'tmj.uuid as judgment_id',
    'tmf.freq_id as freq_real_id',
    'tmoic.om_item_check_kanban_id as om_item_check_kanban_real_id',
    'tmm.machine_id as machine_real_id',
    'tmu.uuid as pic_id',
    'tmu_actual.uuid as actual_pic_id',
    'tmu.user_id as pic_real_id',
    'tml.line_nm',
    'tmg.group_nm',
    'tmm.machine_nm',
    'tmoic.kanban_nm',
    'tmoic.item_check_nm',
    'tmoic.location_nm',
    'tmoic.method_nm',
    'tmoic.standart_nm',
    'tmoic.standart_time::real as standart_time',
    'tmu.fullname as pic_nm',
    'tmu_actual.fullname as actual_pic_nm',
    'tross.actual_time',
    'tmf.freq_nm',
    'trmsc.year_num',
    'trmsc.month_num',
    'tmj.judgment_nm',
    'tmj.is_abnormal'
]

const selectSubScheduleSql = selectSubScheduleCol.join(', ')

/**
 * @typedef {Object} ChildrenSubSchedule
 * 
 * @param {number} mainScheduleRealId 
 * @param {number} freqRealId 
 * @param {number} zoneRealId 
 * @param {number} kanbanRealId 
 * @param {?number} picRealId 
 * @returns {Promise<Array<ChildrenSubSchedule>>}
 */
const childrenSubSchedule = async (
    mainScheduleRealId,
    freqRealId,
    om_item_check_kanban_id,
    machine_id,
    planPicRealId
) => {
    let byPic = ``
    if (planPicRealId)
    {
        byPic = ` and tross.pic_id = '${planPicRealId}' `
    }

    let childrenSql = `
              select * from (
                 select
                    tross.uuid as om_sub_schedule_id,
                    trcc1.tl_sign_checker_id,
                    tmsc.date,
                    EXTRACT('Day' FROM tmsc.date)::INTEGER as date_num,
                    tmsc.is_holiday, 
                    case
                      when finding.finding_date = tmsc.date then
                        'PROBLEM'
                      when tross.actual_time is not null then
                        'ACTUAL'
                      when tross.plan_time is not null then
                        'PLANNING'
                    end as status,
                    trcc1.sign as sign_tl
                  from
                      ${fromSubScheduleSql}
                      left join lateral (
                                        select
                                          uuid as tl_sign_checker_id,
                                          sign
                                        from
                                          ${table.tb_r_om_schedule_sign_checkers}
                                        where
                                          om_main_schedule_id = tross.om_main_schedule_id
                                          and is_tl = true 
                                          and end_date = tmsc."date"
                                        limit 1
                      ) trcc1 on true
                      left join lateral (
                        select *
                        from
                            v_om_finding_list vofl
                        where
                              vofl.freq_id = tmf.uuid
                          and vofl.om_item_check_kanban_id = tmoic.uuid
                          and vofl.machine_id = tmm.uuid
                          and vofl.finding_date = tmsc.date
                          and vofl.deleted_dt is null
                        order by vofl.finding_date desc
                        limit 1
                      ) finding on true
                  where
                      tross.deleted_dt is null
                      and tross.om_main_schedule_id = ${mainScheduleRealId}
                      and tross.freq_id = '${freqRealId}'
                      and tross.om_item_check_kanban_id = '${om_item_check_kanban_id}'
                      and tross.machine_id = '${machine_id}'
                      ${byPic}
              ) a order by date_num      
           `
    //console.warn('childrensql', childrenSql)
    const children = await queryCustom(childrenSql, false)

    return children.rows
}

module.exports = {
    getOmMainSchedule: async (req, res) => {
        try
        {
            const { line_id, group_id, month_year_num } = req.query
            let { limit, current_page } = req.query

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            const fromSql = `
          ${table.tb_r_om_main_schedules} troms
          join ${table.tb_m_lines} tml on troms.line_id = tml.line_id
          join ${table.tb_m_groups} tmg on troms.group_id = tmg.group_id
      `

            let mainScheduleSql = `
                select 
                    row_number () over (
                        order by
                        troms.created_dt
                    )::integer as no,
                    troms.uuid as om_main_schedule_id,
                    tml.uuid as line_id,
                    tmg.uuid  as group_id,
                    troms.year_num,
                    troms.month_num,
                    troms.section_head_sign,
                    troms.group_leader_sign,
                    troms.team_leader_sign,
                    tml.line_nm,
                    tmg.group_nm
                from
                    ${fromSql}
                where 
                    1 = 1
            `

            let filterCondition = [
                ' and troms.deleted_dt is null '
            ]

            if (line_id && line_id != null && line_id != "")
            {
                filterCondition.push(` troms.line_id = (select line_id from ${table.tb_m_lines} where uuid = '${line_id}') `)
            }
            if (month_year_num && month_year_num != null && month_year_num != "")
            {
                let MYFilterSplit = month_year_num.split('-')
                if (MYFilterSplit.length == 1)
                {
                    if (MYFilterSplit[0].length == 4)
                    {
                        filterCondition.push(` troms.year_num = '${MYFilterSplit[0]}}' `)
                    }
                    else
                    {
                        filterCondition.push(` troms.month_num = '${parseInt(MYFilterSplit[0])}}' `)
                    }
                }
                else
                {
                    filterCondition.push(` troms.year_num || '-' || troms.month_num = '${MYFilterSplit[0]}-${parseInt(MYFilterSplit[1])}' `)
                }
            }
            if (group_id && group_id != null && group_id != "")
            {
                filterCondition.push(` troms.group_id = (select group_id from ${table.tb_m_groups} where uuid = '${group_id}') `)
            }

            const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

            filterCondition = filterCondition.join(' and ')
            mainScheduleSql = mainScheduleSql.concat(` ${filterCondition} `)
            mainScheduleSql = mainScheduleSql.concat(` order by troms.created_dt ${qLimit} ${qOffset} `)

            //logger(mainScheduleSql, 'mainScheduleSql')
            const mainScheduleQuery = await queryCustom(mainScheduleSql, false)
            let result = mainScheduleQuery.rows

            if (result.length > 0)
            {
                const count = await queryCustom(`select count(troms.om_main_schedule_id)::integer as count from ${fromSql} where 1 = 1 ${filterCondition}`)
                const countRows = count.rows[0]
                result = {
                    current_page: current_page,
                    total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +limit) : 0,
                    total_data: countRows.count,
                    limit: limit,
                    list: result,
                }
            }

            //const result = await Promise.all(mainScheduleQuery.rows)

            response.success(res, "Success to get om main schedule", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, "Error to get om main schedule")
        }
    }, 
    getOmSubSchedule: async (req, res) => {
        try
        {
            const { om_main_schedule_id, freq_id, om_item_check_kanban_id, line_id, group_id, month_year_num } = req.query

            if (
                !om_main_schedule_id ||
                om_main_schedule_id == "" ||
                om_main_schedule_id == null ||
                om_main_schedule_id == "0"
            )
            {
                response.failed(res, "Error to get om main schedule id not provide")
                return
            }

            let result = {
                schedule: [],
                sign_checker_gl: []
            }

            let scheduleSql =
                `
                select * from (
                    select distinct on (tross.freq_id, tross.machine_id, tross.om_item_check_kanban_id)
                    ${selectSubScheduleSql}  
                from
                    ${fromSubScheduleSql}
                where
                    tross.om_main_schedule_id = (select om_main_schedule_id from ${table.tb_r_om_main_schedules} where uuid = '${om_main_schedule_id}')
                ) a 
                where
                    1 = 1
            `

            let filterCondition = []

            if (freq_id && freq_id != null && freq_id != "")
            {
                filterCondition.push(` freq_id = '${freq_id}' `)
            }
            if (om_item_check_kanban_id && om_item_check_kanban_id != null && om_item_check_kanban_id != "")
            {
                filterCondition.push(` om_item_check_kanban_id = '${om_item_check_kanban_id}' `)
            }
            if (line_id && line_id != null && line_id != "")
            {
                filterCondition.push(` line_id = '${line_id}' `)
            }
            if (month_year_num && month_year_num != null && month_year_num != "")
            {
                let MYFilterSplit = month_year_num.split('-')

                if (MYFilterSplit.length == 1)
                {
                    if (MYFilterSplit[0].length == 4)
                    {
                        filterCondition.push(` year_num = '${MYFilterSplit[0]}}' `)
                    }
                    else
                    {
                        filterCondition.push(` month_num = '${parseInt(MYFilterSplit[0])}}' `)
                    }
                }
                else
                {
                    filterCondition.push(` year_num || '-' || month_num = '${MYFilterSplit[0]}-${parseInt(MYFilterSplit[1])}' `)
                }
            }
            if (group_id && group_id != null && group_id != "")
            {
                filterCondition.push(` group_id = '${group_id}' `)
            }

            if (filterCondition.length > 0)
            {
                filterCondition = filterCondition.join(' and ')
                scheduleSql = scheduleSql.concat(` and ${filterCondition} `)
            }

            scheduleSql = scheduleSql.concat(
                ` 
                    order by 
                    case freq_nm 
                    when 'Daily' then 1
                    when 'Weekly' then 2
                    when 'Monthly' then 3
                    end 
                `
            )

            //console.log('scheduleSql', scheduleSql)
            //logger(scheduleSql, 'scheduleSql')
            const scheduleQuery = await queryCustom(scheduleSql, false)

            if (scheduleQuery.rows && scheduleQuery.rows.length > 0)
            {
                let mainScheduleRealId = null

                const scheduleRows = scheduleQuery.rows.map(async (item) => {
                    mainScheduleRealId = item.om_main_schedule_id

                    const countRowSpanSql =
                        `
                            with
                                machines as (
                                    select
                                        count(distinct om_item_check_kanban_id)::integer as machine_rows
                                    from
                                        ${table.tb_r_om_sub_schedules}
                                    where
                                        freq_id = ${item.freq_real_id}
                                        and om_main_schedule_id = ${item.om_main_schedule_id}
                                    group by
                                        machine_id
                                ),
                                freqs as (
                                    select
                                        count(distinct om_item_check_kanban_id)::integer as freq_rows
                                    from
                                        ${table.tb_r_om_sub_schedules}
                                    where
                                        freq_id = ${item.freq_real_id}
                                        and om_main_schedule_id = ${item.om_main_schedule_id}
                                    group by
                                        freq_id
                                )
                                select * from 
                                    machines  
                                    full outer join freqs on true
                        `

                    //console.log('countRowSpanSql', countRowSpanSql)
                    const countRowSpanQuery = await queryCustom(countRowSpanSql, false)

                    let countRows = countRowSpanQuery.rows
                    if (countRows && countRows.length > 0)
                    {
                        countRows = countRows[0]
                        item.row_span_freq = countRows.freq_rows ?? 1
                        item.row_span_machine = countRows.machine_rows ?? 1
                    } else
                    {
                        item.row_span_freq = 1
                        item.row_span_machine = 1
                    }

                    item.children = await childrenSubSchedule(
                        mainScheduleRealId,
                        item.freq_real_id,
                        item.om_item_check_kanban_real_id,
                        item.machine_real_id,
                        item.pic_real_id
                    )

                    item.om_main_schedule_id = item.om_main_schedule_uuid

                    delete item.freq_real_id
                    delete item.om_item_check_kanban_real_id
                    delete item.machine_real_id
                    delete item.pic_real_id
                    delete item.om_main_schedule_uuid
                    delete item.year_num
                    delete item.month_num

                    return item
                })

                const signCheckerQuery = async (who = '') => {
                    let whoIs = ``
                    if (who == 'gl')
                    {
                        whoIs = 'and is_gl = true'
                    }

                    return await queryCustom(
                        `
                            select 
                                uuid as sign_checker_id,
                                sign,
                                start_date,
                                end_date,
                                (end_date - start_date)::integer + 1 as col_span
                            from 
                                ${table.tb_r_om_schedule_sign_checkers} 
                            where 
                                om_main_schedule_id = '${mainScheduleRealId}' 
                                ${whoIs}
                            order by
                                start_date
                        `
                        ,
                        false
                    )
                }

                const signGl = await signCheckerQuery('gl')

                result.schedule = await Promise.all(scheduleRows)
                result.sign_checker_gl = signGl.rows
            }

            response.success(res, "Success to get om sub schedule", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, "Error to get om sub schedule")
        }
    },
    getDetailOmSubSchedule: async (req, res) => {
        try
        {
            const sub_schedule_uuid = req.params.id

            const subScheduleSql = 
                `
                    select 
                        ${selectSubScheduleSql}
                        , tmsc.date
                        , EXTRACT('Day' FROM tmsc.date)::INTEGER as date_num
                    from
                        ${fromSubScheduleSql}
                    where
                        tross.uuid = '${sub_schedule_uuid}'
                    limit 1
                `

            let subScheduleQuery = await queryCustom(subScheduleSql, false)
            if (subScheduleQuery.rows.length == 0)
            {
                throw "Can't find 4s sub schedule with id provided"
            }

            subScheduleQuery = subScheduleQuery.rows[0]

            const findings = await queryCustom(
                `
                    select 
                        * 
                    from 
                        ${table.v_om_finding_list} 
                    where
                        deleted_dt is null 
                        and 
                            (
                                om_sub_schedule_id = '${sub_schedule_uuid}'
                                or 
                                (
                                    line_id = '${subScheduleQuery.line_id}'
                                    and group_id = '${subScheduleQuery.group_id}'
                                    and freq_id = '${subScheduleQuery.freq_id}'
                                    and machine_id = '${subScheduleQuery.machine_id}'
                                    and om_item_check_kanban_id = '${subScheduleQuery.om_item_check_kanban_id}'
                                )
                            )

                    order by
                        created_dt desc
                `
            )

            subScheduleQuery.om_main_schedule_id = subScheduleQuery.om_main_schedule_uuid
            subScheduleQuery.findings = findings.rows

            delete subScheduleQuery.freq_real_id
            delete subScheduleQuery.zone_real_id
            delete subScheduleQuery.kanban_real_id
            delete subScheduleQuery.pic_real_id
            delete subScheduleQuery.om_main_schedule_uuid

            response.success(res, "Success to get detail om sub schedule", subScheduleQuery)
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to get om sub schedule")
        }
    },
    getOmSignCheckerBySignCheckerId: async (req, res) => {
        try
        {
            const signCheckerUuid = req.params.sign_checker_id

            const signCheckerRows = await queryGET(
                table.tb_r_om_schedule_sign_checkers,
                `where uuid = '${signCheckerUuid}'`,
                [
                    'uuid as sign_checker_id',
                    'sign',
                    'is_tl',
                    'is_gl',
                ]
            )

            let result = {}
            if (signCheckerRows)
            {
                result = signCheckerRows[0] ?? {}
                if (result)
                {
                    if (!result.is_tl)
                    {
                        delete result.is_tl
                    }
                    if (!result.is_gl)
                    {
                        delete result.is_gl
                    }
                }
            }

            response.success(res, "Success to get om sign checker", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, "Error to get om sign checker")
        }
    },
    ediOmSubSchedule: async (req, res) => {
        try
        {
            let schedulRow = await queryGET(
                table.tb_r_om_sub_schedules,
                `WHERE om_sub_schedule_id = (select om_sub_schedule_id from ${table.tb_r_om_sub_schedules} where uuid = '${req.params.id}' limit 1)`
            )

            if (!schedulRow)
            {
                response.failed(
                    res,
                    "Error to edit om planning schedule, can't find schedule data"
                )
                return
            }

            schedulRow = schedulRow[0]


            const body = {}
            if (req.body.pic_id)
            {
                body.pic_id = ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.pic_id}') `
            }

            if (req.body.actual_pic_id)
            {
                body.actual_pic_id = ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.actual_pic_id}') `
            }

            if (req.body.actual_date)
            {
                body.actual_time = req.body.actual_date
            }

            await queryTransaction(async (db) => {
                const attrsUpdate = await attrsUserUpdateData(req, body)
                const updateCondition = 
                    `
                        om_main_schedule_id = '${schedulRow.om_main_schedule_id}' 
                        and freq_id = '${schedulRow.freq_id}' 
                        and om_item_check_kanban_id = '${schedulRow.om_item_check_kanban_id}' 
                        and machine_id = '${schedulRow.machine_id}'
                    `

                await queryPutTransaction(
                    db,
                    table.tb_r_om_sub_schedules,
                    attrsUpdate,
                    `WHERE ${updateCondition}`
                )

                if (req.body.plan_date)
                {
                    await db.query(
                        `
                            update 
                                ${table.tb_r_om_sub_schedules} 
                            set 
                                plan_time = '${req.body.plan_date}' 
                            where 
                                ${updateCondition} 
                                and schedule_id = (select schedule_id from ${table.tb_m_schedules} where "date" = '${req.body.plan_date}')
            `
                    )
                }

                if (req.body.before_plan_date)
                {
                    await db.query(
                        `
                            update 
                                ${table.tb_r_om_sub_schedules} 
                            set 
                                plan_time = null
                            where 
                                ${updateCondition} 
                                and schedule_id = (select schedule_id from ${table.tb_m_schedules} where "date" = '${req.body.before_plan_date}')
            `
                    )
                }
            })

            response.success(res, "Success to edit om schedule plan", [])
        } catch (e)
        {
            console.log(e)
            response.failed(res, "Error to edit om schedule plan")
        }
    },
    signOmSchedule: async (req, res) => {
        try
        {
            const sign_checker_id = req.params.sign_checker_id

            let signCheckerQuery = await queryGET(
                table.tb_r_om_schedule_sign_checkers,
                `where uuid = '${sign_checker_id}'`,
                [
                    'sign',
                    'is_tl',
                    'is_gl',
                ]
            )

            if (!signCheckerQuery || signCheckerQuery.length == 0)
            {
                throw "invalid params, unknown data"
            }

            let attrsUpdate = await attrsUserUpdateData(req, req.body)
            await queryPUT(table.tb_r_om_schedule_sign_checkers, attrsUpdate, `WHERE uuid = '${sign_checker_id}'`)
            response.success(res, 'success to sign om schedule', [])
        } catch (e)
        {
            console.log(e)
            response.failed(res, "Error to sign om schedule")
        }
    },
    deleteOmMainSchedule: async (req, res) => {
        try
        {
            let obj = {
                deleted_dt: "CURRENT_TIMESTAMP",
                deleted_by: req.user.fullname
            }

            await queryPUT(table.tb_r_om_main_schedules, obj, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'success to delete om main schedule', [])
        } catch (e)
        {
            console.log(e)
            response.failed(res, "Error to delete om main schedule")
        }
    },
    deleteOmSubSchedule: async (req, res) => {
        try
        {
            let subScheduleRow = await queryGET(
                table.tb_r_om_sub_schedules,
                `WHERE uuid = '${req.params.id}'`
            )

            if (!subScheduleRow)
            {
                response.failed(
                    res,
                    "Error to delete om sub schedule, can't find schedule data"
                )
                return
            }

            subScheduleRow = subScheduleRow[0]

            const result = await queryCustom(
                `
                    update ${table.tb_r_om_sub_schedules}
                    set 
                        plan_time = null,
                        actual_time = null,
                        actual_pic_id = null,
                        changed_by = '${req.user.fullname}',
                        changed_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}'
                    where
                        om_main_schedule_id = '${subScheduleRow.om_main_schedule_id}' 
                        and freq_id = '${subScheduleRow.freq_id}' 
                        and machine_id = '${subScheduleRow.machine_id}' 
                        and om_item_check_kanban_id = '${subScheduleRow.om_item_check_kanban_id}'
                        and schedule_id = '${subScheduleRow.schedule_id}'
                    returning *
                `
            )

            response.success(res, 'success to delete om sub schedule', result.rows[0])
        } catch (e)
        {
            console.log(e)
            response.failed(res, "Error to delete om sub schedule")
        }
    },
}
