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
const { arrayOrderBy, objToString, padTwoDigits } = require("../../helpers/formatting")
const moment = require('moment')
const logger = require('../../helpers/logger')
const { cacheGet, cacheAdd, cacheDelete } = require('../../helpers/cacheHelper')
const { shiftByGroupId, nonShift } = require('../../services/shift.services')
const { genSingleMonthlySubScheduleSchemaOM, singleSignCheckerSqlFromSchemaOM } = require('../../services/om.services')
const { bulkToSchema } = require('../../helpers/schema')
const { uuid } = require('uuidv4')

/**
 * @typedef {Object} ChildrenSubSchedule
 * 
 * @param {number} mainScheduleId 
 * @param {number} freqId 
 * @param {number} zoneRealId 
 * @param {number} kanbanRealId 
 * @param {?number} picRealId 
 * @returns {Promise<Array<ChildrenSubSchedule>>}
 */
const childrenSubSchedule = async (
    mainScheduleId,
    freqId,
    omItemCheckKanbanId,
    machineId,
    planPicId
) => {
    let byPic = ``
    if (planPicId)
    {
        byPic = ` and pic_id = '${planPicId}' `
    }

    let childrenSql = `
              select * from (
                 select
                    om_sub_schedule_id,
                    tl_sign_checker_id,
                    date,
                    date_num,
                    is_holiday,
                    status,
                    sign_tl
                  from
                      ${table.v_om_sub_schedules}
                  where
                      deleted_dt is null
                      and om_main_schedule_id = '${mainScheduleId}'
                      and freq_id = '${freqId}'
                      and om_item_check_kanban_id = '${omItemCheckKanbanId}'
                      and machine_id = '${machineId}'
                      ${byPic}
              ) a order by date_num      
           `
    //logger(childrenSql)
    //console.warn('childrensql', childrenSql)
    const children = await queryCustom(childrenSql, false)

    return children.rows
}

const subScheduleCacheKey = (
    om_main_schedule_id,
    limit = null,
    current_page = null,
    freq_id = null,
    machine_id = null
) => {
    const obj = {
        main_schedule_id: om_main_schedule_id
    }

    if (limit)
    {
        obj.limit = limit
    }
    if (current_page)
    {
        obj.current_page = current_page
    }
    if (freq_id)
    {
        obj.freq_id = freq_id
    }
    if (machine_id)
    {
        obj.machine_id = machine_id
    }

    return objToString(obj)
}

const subScheduleRows = async (
    params,
    original = true,
    isParent = true,
    selectString = null
) => {
    let filterCondition = []

    if (
        params.om_main_schedule_id
        && params.om_main_schedule_id != null
        && params.om_main_schedule_id != ""
    )
    {
        filterCondition.push(` om_main_schedule_id = '${params.om_main_schedule_id}' `)
    }
    if (
        params.freq_id
        && params.freq_id != null
        && params.freq_id != ""
    )
    {
        filterCondition.push(` freq_id = '${params.freq_id}' `)
    }
    if (
        params.om_item_check_kanban_id
        && params.om_item_check_kanban_id != null
        && params.om_item_check_kanban_id != ""
    )
    {
        filterCondition.push(` om_item_check_kanban_id = '${params.om_item_check_kanban_id}' `)
    }
    if (
        params.line_id
        && params.line_id != null
        && params.line_id != ""
    )
    {
        filterCondition.push(` line_id = '${params.line_id}' `)
    }
    if (
        params.month_year_num
        && params.month_year_num != null
        && params.month_year_num != ""
    )
    {
        let MYFilterSplit = params.month_year_num.split('-')

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
    if (params.group_id && params.group_id != null && params.group_id != "")
    {
        filterCondition.push(` group_id = '${params.group_id}' `)
    }
    if (params.machine_id && params.machine_id != null && params.machine_id != "")
    {
        filterCondition.push(` machine_id = '${params.machine_id}' `)
    }
    if (params.date)
    {
        filterCondition.push(` date(plan_time) = '${params.date}' `)
    }

    let paginated = false
    const originScheduleSql = `
            select
                ${isParent ? 'distinct on (freq_id, machine_id, om_item_check_kanban_id)' : ''}
                *
                ${selectString ? `, ${selectString}` : ''}
            from
                ${table.v_om_sub_schedules}
            ${filterCondition.length > 0 ? `where ${filterCondition.join('and')}` : ''}   
        `
    let scheduleSql = `${originScheduleSql}`

    if (params.limit && params.current_page)
    {
        params.current_page = parseInt(params.current_page ?? 1)
        params.limit = parseInt(params.limit ?? 10)

        const qOffset = (params.limit != -1 && params.limit) && params.current_page > 1 ? `OFFSET ${params.limit * (params.current_page - 1)}` : ``
        const qLimit = (params.limit != -1 && params.limit) ? `LIMIT ${params.limit}` : ``

        paginated = true
        scheduleSql = `
            select row_number () over (
                            order by
                            freq_nm
                        )::integer as no, * from ( ${originScheduleSql} ) a order by freq_nm ${qLimit} ${qOffset}
        `
    }

    //console.log('scheduleSql', scheduleSql)
    //logger(scheduleSql, 'scheduleSql')

    const query = (await queryCustom(scheduleSql, false)).rows
    if (original)
    {
        query.map((item) => {
            delete item.created_dt
            delete item.created_by
            delete item.changed_dt
            delete item.changed_by
            delete item.deleted_dt
            delete item.deleted_by

            return item;
        })
    }

    if (paginated)
    {
        const count = await queryCustom(`select count(*)::integer as count from ( ${originScheduleSql} ) a `, false)

        const countRows = count.rows[0]
        return {
            current_page: params.current_page,
            total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +params.limit) : 0,
            total_data: countRows.count,
            limit: params.limit,
            list: query,
        }
    }

    return query
}

module.exports = {
    getOmMainSchedule: async (req, res) => {
        try
        {
            const { line_id, group_id, month_year_num } = req.query
            let { limit, current_page } = req.query

            const cacheKey = req.query
            const cachedMainSchedule = cacheGet(cacheKey)
            if (cachedMainSchedule)
            {
                response.success(res, "Success to get om main schedule", cachedMainSchedule)
                return
            }

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            const fromSql =
                `
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
            const { om_main_schedule_id, limit, current_page, freq_id, machine_id } = req.query

            const cacheKey = subScheduleCacheKey(om_main_schedule_id, limit, current_page, freq_id, machine_id);
            const cachedSchedule = cacheGet(cacheKey)

            if (cachedSchedule)
            {
                console.log('====================================');
                console.log('fetch from cache');
                console.log('====================================');
                response.success(res, "Success to get om sub schedule", cachedSchedule)
                return
            }

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

            const scheduleQuery = await subScheduleRows(req.query)

            if (scheduleQuery)
            {
                const mainScheduleIdRawSql = ` (select om_main_schedule_id from ${table.tb_r_om_main_schedules} where uuid = '${om_main_schedule_id}') `;
                const listOrRows = scheduleQuery.list ? scheduleQuery.list : scheduleQuery;
                const scheduleRows = listOrRows.map(async (item) => {
                    const freqIdRawSql = ` (select freq_id from ${table.tb_m_freqs} where uuid = '${item.freq_id}') `

                    const countRowSpanSql =
                        `
                            with
                                machines as (
                                    select
                                        count(distinct om_item_check_kanban_id)::integer as machine_rows
                                    from
                                        ${table.tb_r_om_sub_schedules}
                                    where
                                        freq_id = ${freqIdRawSql}
                                        and om_main_schedule_id = ${mainScheduleIdRawSql}
                                    group by
                                        machine_id
                                ),
                                freqs as (
                                    select
                                        count(distinct om_item_check_kanban_id)::integer as freq_rows
                                    from
                                        ${table.tb_r_om_sub_schedules}
                                    where
                                        freq_id = ${freqIdRawSql}
                                        and om_main_schedule_id = ${mainScheduleIdRawSql}
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
                        item.om_main_schedule_id,
                        item.freq_id,
                        item.om_item_check_kanban_id,
                        item.machine_id,
                        item.pic_id
                    )

                    delete item.date
                    delete item.date_num
                    delete item.sign_tl

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
                                '${om_main_schedule_id}' as om_main_schedule_id,
                                uuid as sign_checker_id,
                                sign,
                                case 
                                    when date_part('month', start_date) < date_part('month', end_date) then
                                        (date_part('year', end_date) || '-' || trim(to_char(date_part('month', end_date), '00')) ||  '-01')::date
                                    else
                                        start_date
                                end as start_date,
                                end_date,
                                case 
                                    when date_part('month', start_date) = date_part('month', end_date) then
                                        (end_date - start_date)::integer + 1
                                     when date_part('month', start_date) < date_part('month', end_date) then
                                        (end_date - (date_part('year', end_date) || '-' || trim(to_char(date_part('month', end_date), '00')) ||  '-01')::date)::integer 
                                    else 
                                        (end_date - (date_part('year', end_date) || '-' || trim(to_char(date_part('month', end_date), '00')) ||  '-01')::date)::integer + 1
                                    
                                end as col_span
                            from 
                                ${table.tb_r_om_schedule_sign_checkers} 
                            where 
                                om_main_schedule_id = ${mainScheduleIdRawSql}
                                ${whoIs}
                            order by
                                start_date
                        `
                        ,
                        true
                    )
                }

                const holidayTemp = []
                const signGl = (await signCheckerQuery('gl')).rows.map((item) => {
                    item.is_holiday = false
                    return item
                })

                const findHolidaySignChecker = async (dateBetwenStr, i, first = false) => {
                    const holidaySchedule = await queryCustom(
                        `
                                select 
                                     tms.*
                                from 
                                    ${table.tb_m_schedules} tms
                                    left join ${table.tb_m_shifts} shift_holiday on
                                        tms.date between shift_holiday.start_date and shift_holiday.end_date
                                            and shift_holiday.is_holiday = true
                                where 
                                    (tms.is_holiday = true or shift_holiday.is_holiday = true)
                                    and ${dateBetwenStr}
                            `
                    )

                    for (let j = 0; j < holidaySchedule.rows.length; j++)
                    {
                        holidayTemp.push({
                            index: first ? i : i + 1,
                            om_main_schedule_id: om_main_schedule_id,
                            sign_checker_id: null,
                            sign: null,
                            start_date: holidaySchedule.rows[j].date,
                            end_date: holidaySchedule.rows[j].date,
                            col_span: 1,
                            is_holiday: true,
                        })
                    }
                }

                for (let i = 0; i < signGl.length; i++)
                {
                    if (i == 0)
                    {
                        await findHolidaySignChecker(`date between 
                                        (date_part('year', '${signGl[i].end_date}'::date) || '-' || trim(to_char(date_part('month', '${signGl[i].end_date}'::date), '00')) ||  '-01')::date
                                        and '${signGl[i].end_date}'`, i, true)
                    }

                    if (signGl[i + 1])
                    {
                        await findHolidaySignChecker(`date between '${signGl[i].end_date}' and '${signGl[i + 1].start_date}'`, i)
                    }

                    if (i == signGl.length - 1)
                    {
                        await findHolidaySignChecker(`date between 
                                        '${signGl[i].end_date}'
                                        and (
                                            date_part('year', '${signGl[i].end_date}'::date) 
                                                || '-' 
                                                || trim(to_char(date_part('month', '${signGl[i].end_date}'::date), '00')) 
                                                ||  '-' 
                                                || 
                                                date_part('day', (date_trunc('month', '${signGl[i].end_date}'::date) + interval '1 month - 1 day')::date)
                                            )::date`, i)
                    }
                }

                for (let i = 0; i < holidayTemp.length; i++)
                {
                    delete holidayTemp[i].index
                    signGl.splice(holidayTemp[i].index, 0, holidayTemp[i])
                }

                if (scheduleQuery.list)
                {
                    result.schedule = {
                        ...scheduleQuery,
                        list: await Promise.all(scheduleRows)
                    }
                } else
                {
                    result.schedule = await Promise.all(scheduleRows)
                }

                result.sign_checker_gl = arrayOrderBy(signGl, (gl) => gl.start_date)

                cacheAdd(cacheKey, result)
            }

            response.success(res, "Success to get om sub schedule", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, "Error to get om sub schedule")
        }
    },
    getOmSubScheduleToday: async (req, res) => {
        try
        {
            const result = await subScheduleRows(
                req.query,
                true,
                false,
                "date(plan_time) as plan_check_dt, date(actual_time) as actual_check_dt, EXTRACT('day' from  plan_time)::real as idxDate"
            )
            response.success(res, "Success to get today activity om sub schedule", result)
        }
        catch (error)
        {
            console.log(error)
            response.failed(res, "Error to get today activity om sub schedule summary")
        }
    },
    getDetailOmSubSchedule: async (req, res) => {
        try
        {
            const sub_schedule_uuid = req.params.id

            const subScheduleSql =
                `
                    select 
                        *
                    from
                        ${table.v_om_sub_schedules}
                    where
                        om_sub_schedule_id = '${sub_schedule_uuid}'
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
                        *,
                        case when finding_img is not null then
                            'http://mt-system.id:3200/api/v1/file?path='::text || finding_img
                        end as finding_img
                    from 
                        ${table.v_om_finding_list} 
                    where
                        deleted_dt is null 
                        and om_sub_schedule_id = '${sub_schedule_uuid}'
                    order by
                        changed_dt desc
                `
            )

            subScheduleQuery.finding = findings?.rows[0] ?? null

            response.success(res, "Success to get detail om sub schedule", subScheduleQuery)
        } catch (error)
        {
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
    getOmCountTotalSummary: async (req, res) => {
        try
        {
            const { line_id } = req.query
            let { month, year } = req.query

            if (!month || month == null || month == -1)
            {
                month = moment().format('MM')
            }

            if (!year || year == null || year == -1)
            {
                year = moment().format('YYYY')
            }

            const baseSql = (alias, where) => {
                const byLineId = (line_id && line_id != -1) ? `and troms.line_id = (SELECT line_id FROM ${table.tb_m_lines} WHERE uuid = '${line_id}')` : ''

                return `
                select
                     count(*)::real as ${alias}
                 from
                     ${table.tb_r_om_sub_schedules} tross
                         join ${table.tb_r_om_main_schedules} troms on tross.om_main_schedule_id = troms.om_main_schedule_id
                 where
                         (EXTRACT(month from tross.plan_time), EXTRACT(year from tross.plan_time)) = (${+month},${+year})
                   and   tross.deleted_by IS NULL
                   ${byLineId}
                   ${where}
              `
            }

            const delay = baseSql(
                'delay',
                `and actual_time is null and date(tross.plan_time) < current_date`
            )

            const progress = baseSql(
                'progress',
                `and actual_time is null and date(tross.actual_time) >= current_date`
            )

            const done = baseSql(
                'done',
                `and actual_time is not null and date(tross.actual_time) >= current_date`
            )

            $sql = `with delay as (${delay}), progress as (${progress}), done as (${done}) select * from delay, progress, done`

            let result = (await queryCustom($sql, false)).rows
            if (result.length > 0)
            {
                result = result[0]

                /* const copy = []
                for (var key of Object.keys(result))
                {
                    copy.push({ [key]: result[key] })
                }

                result = copy */
            }
            else 
            {
                result = {}
            }

            response.success(res, 'Success to count total summary om', result)
        }
        catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
    ediOmSubSchedule: async (req, res) => {
        try
        {
            let schedulRow = await queryCustom(
                `
                    select 
                        tross.*,
                        troms.uuid as om_main_schedule_uuid,
                        troms.group_id,
                        troms.line_id,
                        troms.year_num ||'-'|| trim(to_char(troms.month_num, '00')) as month_year_num
                    from 
                        ${table.tb_r_om_sub_schedules} tross
                        join ${table.tb_r_om_main_schedules} troms on tross.om_main_schedule_id = troms.om_main_schedule_id
                    where
                        tross.om_sub_schedule_id = (select om_sub_schedule_id from ${table.tb_r_om_sub_schedules} where uuid = '${req.params.id}' limit 1)
                `
            )

            if (schedulRow.rows.length == 0)
            {
                response.failed(
                    res,
                    "Error to edit om planning schedule, can't find schedule data"
                )
                return
            }

            schedulRow = schedulRow.rows[0]


            const body = {}
            if (req.body.pic_id)
            {
                body.pic_id = ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.pic_id}') `
            }

            await queryTransaction(async (db) => {
                const attrsUpdate = await attrsUserUpdateData(req, body)
                let updateCondition =
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

                let whereActual = []
                if (req.body.actual_pic_id)
                {
                    whereActual.push(` actual_pic_id = (select user_id from ${table.tb_m_users} where uuid = '${req.body.actual_pic_id}') `)
                }
                if (req.body.actual_date)
                {
                    whereActual.push(` actual_time = '${req.body.actual_date}' `)
                }
                if (req.body.actual_duration)
                {
                    whereActual.push(` actual_duration = '${req.body.actual_duration}' `)
                }
                if (req.body.judgment_id)
                {
                    whereActual.push(` judgment_id = (select judgment_id from ${table.tb_m_judgments} where uuid = '${req.body.judgment_id}') `)
                }

                if (whereActual.length > 0)
                {
                    await db.query(
                        `
                            update
                                ${table.tb_r_om_sub_schedules} 
                            set 
                                ${whereActual.join(', ')}
                            where 
                                uuid = '${req.params.id}'
                        `
                    )
                }

                if (req.body.plan_date && req.body.before_plan_date)
                {
                    //#region update plan_date validation
                    const planDateUpdate = moment(req.body.plan_date, 'YYYY-MM-DD')
                    const previousDate = moment(req.body.before_plan_date, 'YYYY-MM-DD')

                    if (planDateUpdate.month() < previousDate.month() || planDateUpdate.year() < previousDate.year())
                    {
                        throw "Can't edit schedule plan on previous date"
                    }
                    //#endregion

                    let newMainScheduleSet = ''
                    let newMainScheduleRealId = null
                    if (planDateUpdate.month() > previousDate.month())
                    {
                        const checkHeaderNextMonth = await db.query(`
                            select 
                                * 
                            from 
                                ${table.tb_r_om_main_schedules} 
                            where 
                                year_num = '${planDateUpdate.year()}' 
                                and month_num = '${planDateUpdate.month() + 1}'
                                and line_id = '${schedulRow.line_id}'
                                and group_id = '${schedulRow.group_id}'
                        `)

                        if (checkHeaderNextMonth.rowCount == 0)
                        {
                            const newMainSchedule = await db.query(`
                                insert into ${table.tb_r_om_main_schedules}
                                (uuid, line_id, group_id, year_num, month_num, created_by, created_dt, changed_by, changed_dt)
                                values
                                (
                                    '${uuid()}', 
                                    '${schedulRow.line_id}', 
                                    '${schedulRow.group_id}', 
                                    '${planDateUpdate.year()}', 
                                    '${planDateUpdate.month() + 1}',
                                    '${req.user.fullname}', 
                                    '${moment().format('YYYY-MM-DD HH:mm:ss')}', 
                                    '${req.user.fullname}', 
                                    '${moment().format('YYYY-MM-DD HH:mm:ss')}'
                                )
                                returning *
                            `);

                            newMainScheduleSet = `, om_main_schedule_id = '${newMainSchedule.rows[0].om_main_schedule_id}'`
                            newMainScheduleRealId = newMainSchedule.rows[0].om_main_schedule_id
                        }
                        else
                        {
                            newMainScheduleSet = `, om_main_schedule_id = '${checkHeaderNextMonth.rows[0].om_main_schedule_id}'`
                            newMainScheduleRealId = checkHeaderNextMonth.rows[0].om_main_schedule_id
                        }
                    }

                    const sqlUpdateNewPlanDate = (newMainScheduleSet = '') => {
                        const s = `
                            update 
                                ${table.tb_r_om_sub_schedules} 
                            set 
                                plan_time = '${req.body.plan_date}' 
                                ${newMainScheduleSet}
                            where 
                                ${updateCondition} 
                                and schedule_id = (select schedule_id from ${table.tb_m_schedules} where "date" = '${req.body.plan_date}')
                        `

                        console.log('sqlUpdateNewPlanDate', s);
                        return s
                    }

                    const sqlUpdateOldPlanDate = () => {
                        const s = `
                            update 
                                ${table.tb_r_om_sub_schedules} 
                            set 
                                plan_time = null
                            where 
                                ${updateCondition} 
                                and schedule_id = (select schedule_id from ${table.tb_m_schedules} where "date" = '${req.body.before_plan_date}')
                        `

                        console.log('sqlUpdateOldPlanDate', s);
                        return s
                    }


                    // updating previous plan date
                    await db.query(sqlUpdateOldPlanDate())

                    if (newMainScheduleSet == '')
                    {
                        await db.query(sqlUpdateNewPlanDate())
                    }
                    else
                    {
                        //find previous 1 month schedule, used previous updatecondition value before reinit
                        const findAvailPlanTimeSql = `select 
                                            * 
                                          from 
                                            ${table.tb_r_om_sub_schedules} 
                                          where 
                                            ${updateCondition}
                                            and plan_time is not null`
                        console.log('findAvailPlanTimeSql', findAvailPlanTimeSql);
                        const findAvailPlanTimeQuery = await db.query(findAvailPlanTimeSql)
                        console.log('findAvailPlanTime length', findAvailPlanTimeQuery.rowCount);
                        if (findAvailPlanTimeQuery.rowCount == 0)
                        {
                            //delete if plan time null
                            await db.query(`delete from ${table.tb_r_om_sub_schedules} where ${updateCondition}`)
                        }

                        updateCondition = `om_main_schedule_id = '${newMainScheduleRealId}' 
                                and freq_id = '${schedulRow.freq_id}' 
                                and om_item_check_kanban_id = '${schedulRow.om_item_check_kanban_id}' 
                                and machine_id = '${schedulRow.machine_id}'`

                        //#region check month and year updated plan_date by mandatory id
                        const monthlyPlanSql = `
                            select 
                                * 
                            from 
                                ${table.tb_r_om_sub_schedules} 
                            where 
                                ${updateCondition} 
                                and schedule_id in (
                                    select 
                                        schedule_id 
                                    from 
                                        ${table.tb_m_schedules} 
                                    where 
                                        date_part('year', date) = '${planDateUpdate.year()}' 
                                        and date_part('month', date) = '${planDateUpdate.month() + 1}'
                                )
                        `
                        console.log('monthlyPlanSql', monthlyPlanSql);
                        const monthlyPlanQuery = await db.query(monthlyPlanSql)
                        //#endregion

                        if (monthlyPlanQuery.rowCount == 0)
                        {
                            const currentMonthDays = await nonShift(planDateUpdate.year(), planDateUpdate.month() + 1)
                            const singleKanbanSchedule = await bulkToSchema(genSingleMonthlySubScheduleSchemaOM(
                                {
                                    om_item_check_kanban_id: schedulRow.om_item_check_kanban_id,
                                    machine_id: schedulRow.machine_id,
                                    freq_id: schedulRow.freq_id,
                                    om_main_schedule_id: newMainScheduleRealId
                                },
                                {
                                    line_id: schedulRow.line_id,
                                    group_id: schedulRow.group_id,
                                },
                                currentMonthDays,
                                moment(planDateUpdate).format('YYYY-MM-DD')
                            ))

                            const signCheckerScheduleSchema = await singleSignCheckerSqlFromSchemaOM(
                                planDateUpdate.year(),
                                planDateUpdate.month() + 1,
                                {
                                    line_id: schedulRow.line_id,
                                    group_id: schedulRow.group_id,
                                },
                                currentMonthDays,
                                newMainScheduleRealId
                            )

                            if (singleKanbanSchedule.columns.length > 0)
                            {
                                const sqlInSubSchedule = `insert into ${table.tb_r_om_sub_schedules} (${singleKanbanSchedule.columns}) values ${singleKanbanSchedule.values}`
                                console.log('sqlInSubSchedule', sqlInSubSchedule);
                                await db.query(sqlInSubSchedule)
                            }

                            if (signCheckerScheduleSchema.columns.length > 0)
                            {
                                const sqlInSignChecker = `insert into ${table.tb_r_om_schedule_sign_checkers} (${signCheckerScheduleSchema.columns}) values ${signCheckerScheduleSchema.values}`
                                console.log('sqlInSignChecker', sqlInSignChecker);
                                await db.query(sqlInSignChecker)
                            }

                        }
                        else
                        {
                            // updating previous plan date
                            await db.query(sqlUpdateOldPlanDate())

                            // updating new plan date
                            await db.query(sqlUpdateNewPlanDate(newMainScheduleSet))
                        }
                    }
                }
            })

            cacheDelete(subScheduleCacheKey(schedulRow.om_main_schedule_uuid))

            response.success(res, "Success to edit om schedule plan", [])
        } catch (e)
        {
            logger(e, 'message')
            console.log(e)
            response.failed(res, e)
        }
    },
    signOmSchedule: async (req, res) => {
        try
        {
            const sign_checker_id = req.params.sign_checker_id

            let signCheckerQuery = await queryCustom(
                `
                    select
                        trossc.sign,
                        trossc.is_tl,
                        trossc.is_gl,
                        troms.uuid as om_main_schedule_uuid
                    from 
                        ${table.tb_r_om_schedule_sign_checkers} trossc
                        join ${table.tb_r_om_main_schedules} troms on trossc.om_main_schedule_id = troms.om_main_schedule_id
                    where
                        trossc.uuid = '${sign_checker_id}'
                `,
                false
            )

            if (!signCheckerQuery || signCheckerQuery.length == 0)
            {
                throw "invalid params, unknown data"
            }

            let attrsUpdate = await attrsUserUpdateData(req, req.body)
            await queryPUT(table.tb_r_om_schedule_sign_checkers, attrsUpdate, `WHERE uuid = '${sign_checker_id}'`)

            cacheDelete(signCheckerQuery.rows[0].om_main_schedule_uuid)

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
            let subScheduleRow = await queryCustom(
                `
                    select 
                        tross.*,
                        troms.uuid as om_main_schedule_uuid,
                        troms.group_id,
                        troms.line_id,
                        troms.year_num ||'-'|| trim(to_char(troms.month_num, '00')) as month_year_num
                    from 
                        ${table.tb_r_om_sub_schedules} tross
                        join ${table.tb_r_om_main_schedules} troms on tross.om_main_schedule_id = troms.om_main_schedule_id
                    where
                        tross.uuid = '${req.params.id}'
                `
            )

            if (subScheduleRow.rows.length == 0)
            {
                response.failed(
                    res,
                    "Error to delete om sub schedule, can't find schedule data"
                )
                return
            }

            subScheduleRow = subScheduleRow.rows[0]

            const transaction = await queryTransaction(async (db) => {
                const updateCondition = `om_main_schedule_id = '${subScheduleRow.om_main_schedule_id}' 
                        and freq_id = '${subScheduleRow.freq_id}' 
                        and machine_id = '${subScheduleRow.machine_id}' 
                        and om_item_check_kanban_id = '${subScheduleRow.om_item_check_kanban_id}'
                        and schedule_id = '${subScheduleRow.schedule_id}'`

                const updateSql = `update ${table.tb_r_om_sub_schedules}
                    set 
                        plan_time = null,
                        actual_time = null,
                        actual_pic_id = null,
                        changed_by = '${req.user.fullname}',
                        changed_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}'
                    where
                        ${updateCondition}
                    returning *`

                const result = await db.query(updateSql)

                //find previous 1 month schedule, used previous updatecondition value before reinit
                const findAvailPlanTimeSql = `select 
                                            * 
                                          from 
                                            ${table.tb_r_om_sub_schedules} 
                                          where 
                                            ${updateCondition}
                                            and plan_time is not null`
                console.log('findAvailPlanTimeSql', findAvailPlanTimeSql);
                const findAvailPlanTimeQuery = await db.query(findAvailPlanTimeSql)
                console.log('findAvailPlanTime length', findAvailPlanTimeQuery.rowCount);
                if (findAvailPlanTimeQuery.rowCount == 0)
                {
                    //delete if plan time null
                    await db.query(`delete from ${table.tb_r_om_sub_schedules} where ${updateCondition}`)
                }

                return result
            })

            cacheDelete(subScheduleCacheKey(subScheduleRow.om_main_schedule_uuid))

            response.success(res, 'success to delete om sub schedule', transaction.rows[0])
        } catch (e)
        {
            console.log(e)
            response.failed(res, "Error to delete om sub schedule")
        }
    },
}
