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
const { arrayOrderBy, objToString } = require("../../helpers/formatting")
const moment = require('moment')
const logger = require('../../helpers/logger')
const { cacheGet, cacheAdd, cacheDelete } = require('../../helpers/cacheHelper')

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
    om_main_schedule_id
) => {
    return objToString({
        main_schedule_id: om_main_schedule_id
    })
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
        scheduleSql = scheduleSql.concat(` order by changed_dt ${qLimit} ${qOffset} `)
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
        const count = await queryCustom(`select count(*)::integer as count from ( ${originScheduleSql} ) a `)

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
            const { om_main_schedule_id } = req.query

            const cacheKey = subScheduleCacheKey(req.query.om_main_schedule_id);
            const cachedSchedule = cacheGet(cacheKey)

            if (cachedSchedule)
            {
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

            if (scheduleQuery && scheduleQuery.length > 0)
            {
                const mainScheduleIdRawSql = ` (select om_main_schedule_id from ${table.tb_r_om_main_schedules} where uuid = '${om_main_schedule_id}') `;
                const scheduleRows = scheduleQuery.map(async (item) => {
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
                                start_date,
                                end_date,
                                (end_date - start_date)::integer + 1 as col_span
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

                for (let i = 0; i < signGl.length; i++)
                {
                    if (signGl[i + 1])
                    {
                        const holidaySchedule = await queryCustom(
                            `
                                select 
                                    * 
                                from 
                                    ${table.tb_m_schedules} 
                                where 
                                    is_holiday = true 
                                    and date between '${signGl[i].end_date}' and '${signGl[i + 1].start_date}'
                            `
                        )

                        for (let j = 0; j < holidaySchedule.rows.length; j++)
                        {
                            holidayTemp.push({
                                index: i + 1,
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
                }

                for (let i = 0; i < holidayTemp.length; i++)
                {
                    delete holidayTemp[i].index
                    signGl.splice(holidayTemp[i].index, 0, holidayTemp[i])
                }

                result.schedule = await Promise.all(scheduleRows)
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
                "date(plan_time) as plan_check_dt, date(actual_time) as actual_time, EXTRACT('day' from  plan_time)::real as idxDate"
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
                        * 
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

            cacheDelete(subScheduleCacheKey(schedulRow.om_main_schedule_uuid))

            response.success(res, "Success to edit om schedule plan", [])
        } catch (e)
        {
            logger(e, 'message')
            console.log(e)
            response.failed(res, "Error to edit om schedule plan")
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

            cacheDelete(subScheduleCacheKey(subScheduleRow.om_main_schedule_uuid))

            response.success(res, 'success to delete om sub schedule', result.rows[0])
        } catch (e)
        {
            console.log(e)
            response.failed(res, "Error to delete om sub schedule")
        }
    },
}
