const table = require("../../config/table")
const {
    queryCustom,
    queryGET,
    queryPUT,
    queryTransaction,
    queryPutTransaction,
    queryPostTransaction,
    poolQuery, queryPOST
} = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const { arrayOrderBy, objToString } = require("../../helpers/formatting")
const moment = require('moment')
const logger = require('../../helpers/logger')
const { cacheGet, cacheAdd, cacheDelete } = require('../../helpers/cacheHelper')
const { uuid } = require("uuidv4")
const { shiftByGroupId } = require('../../services/shift.services')
const { genSingleMonthlySubScheduleSchema, genSingleSignCheckerSqlFromSchema } = require('../../services/4s.services')
const { bulkToSchema } = require('../../helpers/schema')
const { databasePool } = require('../../config/database');
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");

const fromSubScheduleSql = `
    ${table.tb_r_4s_sub_schedules} tbrcs
    join ${table.tb_m_schedules} tmsc on tbrcs.schedule_id = tmsc.schedule_id
    join ${table.tb_m_kanbans} tmk on tbrcs.kanban_id = tmk.kanban_id
    join ${table.tb_m_zones} tmz on tbrcs.zone_id = tmz.zone_id
    join ${table.tb_m_freqs} tmf on tbrcs.freq_id = tmf.freq_id
    join ${table.tb_r_4s_main_schedules} trmsc on 
      tbrcs.main_schedule_id = trmsc.main_schedule_id 
      and trmsc.month_num = date_part('month', tmsc.date)
      and trmsc.year_num = date_part('year', tmsc.date)
    left join ${table.tb_m_users} tmu on tmu.user_id = tbrcs.pic_id
    left join ${table.tb_m_users} tmu_actual on tmu_actual.user_id = tbrcs.actual_pic_id
    join lateral (
      select * from ${table.tb_m_lines} where line_id = trmsc.line_id
    ) tml on true
    join ${table.tb_m_groups} tmg on trmsc.group_id = tmg.group_id
    left join (
      select 
        kanban_id, 
        sum(standart_time)::real as standart_time
      from ${table.tb_m_4s_item_check_kanbans} 
      group by kanban_id
    ) tmich_c on tmk.kanban_id = tmich_c.kanban_id
`

const selectSubScheduleCol = [
    'tml.uuid as line_id',
    'tmg.uuid as group_id',
    'tbrcs.main_schedule_id',
    'trmsc.uuid as main_schedule_uuid',
    'tbrcs.uuid as sub_schedule_id',
    'tmk.uuid as kanban_id',
    'tmz.uuid as zone_id',
    'tmf.uuid as freq_id',
    'tmf.freq_id as freq_real_id',
    'tmz.zone_id as zone_real_id',
    'tmu.uuid as pic_id',
    'tmu_actual.uuid as actual_pic_id',
    'tmk.kanban_id as kanban_real_id',
    'tmu.user_id as pic_real_id',
    'tml.line_nm',
    'tmg.group_nm',
    'tmz.zone_nm',
    'tmk.kanban_no',
    'tmk.area_nm',
    'tmich_c.standart_time::REAL as standart_time',
    'tmu.fullname as pic_nm',
    'tmu_actual.fullname as actual_pic_nm',
    'tbrcs.plan_time',
    'tbrcs.actual_time',
    'tmf.freq_nm',
    'tmf.precition_val',
    'trmsc.year_num',
    'trmsc.month_num',
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
    zoneRealId,
    kanbanRealId,
    planPicRealId
) => {
    let byPic = ``
    if (planPicRealId) {
        byPic = ` and tbrcs.pic_id = '${planPicRealId}' `
    }


    let childrenSql = `
              select * from (
                 select
                    tbrcs.uuid as sub_schedule_id,
                    trcc1.tl1_sign_checker_id,
                    trcc2.gl_sign_checker_id,
                    trcc3.sh_sign_checker_id,
                    tmsc.date,
                    EXTRACT('Day' FROM tmsc.date)::INTEGER as date_num,
                    tmsc.is_holiday or tbrcs.shift_type is null as is_holiday, -- null of shift_type was set as holiday from monthly scheduler 
                    case
                      when item_check.total_checked > 0 and finding.finding_id is not null then
                        'PROBLEM'
                      when item_check.total_checked > 0 and tbrcs.plan_time is not null then
                        'ACTUAL'
                      when tbrcs.shift_type = 'night_shift' and tbrcs.plan_time is null then
                        'NIGHT_SHIFT'
                      when tbrcs.plan_time is not null then
                        'PLANNING'
                    end as status,
                    case
                      when trcc1.sign is not null and trcc1.sign != '' then
                        true::boolean
                      else 
                        false::boolean
                    end as has_tl1_sign,
                    case
                      when trcc2.sign is not null and trcc2.sign != '' then
                        true::boolean
                      else
                        false::boolean
                    end as has_gl_sign,
                    case
                        when trcc3.sign is not null and trcc3.sign != '' then
                            true::boolean
                        else
                            false::boolean
                        end as has_sh_sign,
                    comment.total_comment        
                  from
                      ${fromSubScheduleSql}
                      left join lateral (
                                        select
                                          uuid as tl1_sign_checker_id,
                                          sign
                                        from
                                          ${table.tb_r_4s_schedule_sign_checkers}
                                        where
                                          main_schedule_id = tbrcs.main_schedule_id
                                          and is_tl_1 = true 
                                          and end_date = tmsc."date"
                                        limit 1
                      ) trcc1 on true
                      left join lateral (
                                        select gl_sign_checker_id, sign
                                          from (select row_number() over (order by sign_checker_id) as row_idx,
                                          uuid as gl_sign_checker_id,
                                          sign,
                                          end_date
                                          from tb_r_4s_schedule_sign_checkers
                                          where main_schedule_id = tbrcs.main_schedule_id
                                          and is_gl = true) trcc3
                                          where end_date = tmsc."date"
                                          limit 1
                      ) trcc2 on true
                      left join lateral (
                                          select sh_sign_checker_id, sign
                                          from (select row_number() over (order by sign_checker_id) as row_idx,
                                          uuid as sh_sign_checker_id,
                                          sign,
                                          end_date
                                          from tb_r_4s_schedule_sign_checkers
                                          where main_schedule_id = tbrcs.main_schedule_id
                                          and is_sh = true) trcc3
                                          where end_date = tmsc."date"
                                          limit 1
                      ) trcc3 on true
                      left join lateral (
                        select *
                        from
                            ${table.v_4s_finding_list} v4sfl
                        where
                          v4sfl.sub_schedule_id = tbrcs.uuid
                          and v4sfl.deleted_dt is null
                        order by v4sfl.finding_date desc
                        limit 1
                      ) finding on true
                      left join lateral (
                        select 
                          count(*) as total_checked
                        from 
                          ${table.tb_r_4s_schedule_item_check_kanbans}
                        where
                          item_check_kanban_id in (
                                                    select 
                                                      item_check_kanban_id 
                                                    from 
                                                      ${table.tb_m_4s_item_check_kanbans} 
                                                    where 
                                                      kanban_id = '${kanbanRealId}'
                                                      )
                                                      and sub_schedule_id = tbrcs.sub_schedule_id
                                                      /* and main_schedule_id = tbrcs.main_schedule_id
                                                      and checked_date::date = tbrcs.plan_time::date */
                      ) item_check on true
                     left join lateral (
                         select count(*)::real as total_comment from ${table.tb_r_4s_comments} where sub_schedule_id = tbrcs.sub_schedule_id
                      ) comment on true
                  where
                      tbrcs.deleted_dt is null
                      and tbrcs.main_schedule_id = ${mainScheduleRealId}
                      and tbrcs.freq_id = '${freqRealId}'
                      and tbrcs.zone_id = '${zoneRealId}'
                      and tbrcs.kanban_id = '${kanbanRealId}'
                      
              ) a order by date_num`

    //console.log('childrensql', childrenSql)
    //logger(childrenSql, 'childrenSql')
    //const children = await queryCustom(childrenSql, false)

    const startTime = Date.now();
    const children = await poolQuery(childrenSql);
    const timeTaken = Date.now() - startTime;
    console.log(`4S childrenSubSchedule query time = ${Math.floor(timeTaken / 1000)} seconds`);

    return children.rows
}

const subScheduleCacheKey = (
    main_schedule_id,
    freq_id = null,
    zone_id = null,
    kanban_id = null,
    line_id = null,
    group_id = null,
    month_year_num = null,
    limit = null,
    current_page = null,
) => {
    const obj = {
        main_schedule_id: main_schedule_id
    }

    if (freq_id) {
        obj.freq_id = freq_id
    }
    if (zone_id) {
        obj.zone_id = zone_id
    }
    if (kanban_id) {
        obj.kanban_id = kanban_id
    }
    if (line_id) {
        obj.line_id = line_id
    }
    if (group_id) {
        obj.group_id = group_id
    }
    if (month_year_num) {
        obj.month_year_num = month_year_num
    }
    if (limit) {
        obj.limit = limit
    }
    if (current_page) {
        obj.current_page = current_page
    }

    return objToString(obj)
}

const subScheduleRows = async (
    params
) => {
    const { main_schedule_id, freq_id, zone_id, kanban_id, line_id, group_id, month_year_num } = params
    let { limit, current_page } = params;

    let filterCondition = []

    if (freq_id && freq_id != null && freq_id != "") {
        filterCondition.push(` freq_id = '${freq_id}' `)
    }
    if (zone_id && zone_id != null && zone_id != "") {
        filterCondition.push(` zone_id = '${zone_id}' `)
    }
    if (kanban_id && kanban_id != null && kanban_id != "") {
        filterCondition.push(` kanban_id = '${kanban_id}' `)
    }
    if (line_id && line_id != null && line_id != "") {
        filterCondition.push(` line_id = '${line_id}' `)
    }
    if (month_year_num && month_year_num != null && month_year_num != "") {
        let MYFilterSplit = month_year_num.split('-')

        if (MYFilterSplit.length == 1) {
            if (MYFilterSplit[0].length == 4) {
                filterCondition.push(` year_num = '${MYFilterSplit[0]}}' `)
            } else {
                filterCondition.push(` month_num = '${parseInt(MYFilterSplit[0])}}' `)
            }
        } else {
            filterCondition.push(` year_num || '-' || month_num = '${MYFilterSplit[0]}-${parseInt(MYFilterSplit[1])}' `)
        }
    }
    if (group_id && group_id != null && group_id != "") {
        filterCondition.push(` group_id = '${group_id}' `)
    }

    let paginated = false
    const whereMainSchedule = `(select main_schedule_id from ${table.tb_r_4s_main_schedules} where uuid = '${main_schedule_id}')`
    const originScheduleSql = `
          select * from (
                select distinct on (tbrcs.freq_id, tbrcs.zone_id, tbrcs.kanban_id)
                  ${selectSubScheduleSql}  
              from
                 ${fromSubScheduleSql}
              where
                tbrcs.main_schedule_id = ${whereMainSchedule}
              order by
                tbrcs.freq_id, tbrcs.zone_id, tbrcs.kanban_id, tbrcs.pic_id nulls last
          ) a 
          where
            1 = 1
            ${filterCondition.length > 0 ? `and ${filterCondition.join('and')}` : ''}`
    let scheduleSql = `${originScheduleSql}`

    if (limit && current_page) {
        current_page = parseInt(current_page ?? 1)
        limit = parseInt(limit ?? 10)

        const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
        const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

        paginated = true
        scheduleSql = `
            select row_number () over (
                            order by
                            precition_val
                        )::integer as no, * from ( ${originScheduleSql} ) a order by precition_val ${qLimit} ${qOffset}
        `
    }

    console.log('scheduleSql', scheduleSql)
    //logger(scheduleSql, 'scheduleSql')

    const query = (await poolQuery(scheduleSql)).rows
    if (paginated) {
        const count = await poolQuery(`select count(*)::integer as count from ( ${originScheduleSql} ) a `)

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
    get4sMainSchedule: async (req, res) => {
        try {
            const { line_id, group_id, month_year_num } = req.query
            let { limit, current_page } = req.query

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            const fromSql = `
          ${table.tb_r_4s_main_schedules} trcp
          join ${table.tb_m_lines} tml on trcp.line_id = tml.line_id
          join ${table.tb_m_groups} tmg on trcp.group_id = tmg.group_id
      `

            let mainScheduleSql = `
                select 
                    row_number () over (
                        order by
                        trcp.created_dt
                    )::integer as no,
                    trcp.uuid as main_schedule_id,
                    tml.uuid as line_id,
                    tmg.uuid  as group_id,
                    trcp.year_num,
                    trcp.month_num,
                    trcp.section_head_sign,
                    trcp.group_leader_sign,
                    trcp.team_leader_sign,
                    tml.line_nm,
                    tmg.group_nm
                from
                    ${fromSql}
                where 
                    1 = 1
            `

            let filterCondition = [
                ' and trcp.deleted_dt is null '
            ]

            if (line_id && line_id != null && line_id != "") {
                filterCondition.push(` trcp.line_id = (select line_id from ${table.tb_m_lines} where uuid = '${line_id}') `)
            }
            if (month_year_num && month_year_num != null && month_year_num != "") {
                let MYFilterSplit = month_year_num.split('-')
                if (MYFilterSplit.length == 1) {
                    if (MYFilterSplit[0].length == 4) {
                        filterCondition.push(` trcp.year_num = '${MYFilterSplit[0]}}' `)
                    } else {
                        filterCondition.push(` trcp.month_num = '${parseInt(MYFilterSplit[0])}}' `)
                    }
                } else {
                    filterCondition.push(` trcp.year_num || '-' || trcp.month_num = '${MYFilterSplit[0]}-${parseInt(MYFilterSplit[1])}' `)
                }
            }
            if (group_id && group_id != null && group_id != "") {
                filterCondition.push(` trcp.group_id = (select group_id from ${table.tb_m_groups} where uuid = '${group_id}') `)
            }

            const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

            filterCondition = filterCondition.join(' and ')
            mainScheduleSql = mainScheduleSql.concat(` ${filterCondition} `)
            mainScheduleSql = mainScheduleSql.concat(` order by trcp.created_dt ${qLimit} ${qOffset} `)

            const mainScheduleQuery = await queryCustom(mainScheduleSql)
            let result = mainScheduleQuery.rows

            if (result.length > 0) {
                const count = await queryCustom(`select count(trcp.main_schedule_id)::integer as count from ${fromSql} where 1 = 1 ${filterCondition}`)
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

            response.success(res, "Success to get 4s main schedule", result)
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to get 4s main schedule")
        }
    },
    get4sSubSchedule: async (req, res) => {
        try {
            const {
                main_schedule_id,
                freq_id,
                zone_id,
                kanban_id,
                line_id,
                group_id,
                month_year_num,
                limit,
                current_page
            } = req.query
            const cacheKey = subScheduleCacheKey(main_schedule_id, freq_id, zone_id, kanban_id, line_id, group_id, month_year_num, limit, current_page);
            /*
            const cachedSchedule = cacheGet(cacheKey)

            if (cachedSchedule)
            {
              console.log('get4sSubSchedule fetch from cached');
              response.success(res, "Success to get 4s sub schedule", cachedSchedule)
              return
            } */

            console.log('get4sSubSchedule fetch from query');

            if (
                !main_schedule_id ||
                main_schedule_id == "" ||
                main_schedule_id == null ||
                main_schedule_id == "0"
            ) {
                response.failed(res, "Error to get 4s main schedule id not provide")
                return
            }

            let result = {
                schedule: [],
                sign_checker_gl: [],
                sign_checker_sh: []
            }


            //console.log('scheduleSql', scheduleSql)
            //logger(scheduleSql, 'schedule')
            let scheduleQuery = await subScheduleRows(req.query)

            if (scheduleQuery) {
                let mainScheduleRealId = null
                let scheduleFinalResult = null;
                if (typeof scheduleQuery === 'object') {
                    scheduleFinalResult = scheduleQuery.list;
                } else {
                    scheduleFinalResult = scheduleQuery;
                }

                const scheduleRows = scheduleFinalResult.map(async (item, index) => {
                    mainScheduleRealId = item.main_schedule_id

                    item.row_span_pic = 1
                    item.row_span_freq = 1
                    item.row_span_zone = 1

                    item.children = await childrenSubSchedule(
                        mainScheduleRealId,
                        item.freq_real_id,
                        item.zone_real_id,
                        item.kanban_real_id,
                        item.pic_real_id
                    )

                    item.main_schedule_id = item.main_schedule_uuid

                    delete item.freq_real_id
                    delete item.zone_real_id
                    delete item.kanban_real_id
                    delete item.pic_real_id
                    delete item.main_schedule_uuid
                    delete item.year_num
                    delete item.month_num

                    return item
                })

                const signCheckerQuery = async (who = '') => {
                    let whoIs = ``
                    if (who == 'gl') {
                        whoIs = 'and is_gl = true'
                    } else if (who == 'sh') {
                        whoIs = 'and is_sh = true'
                    }

                    return await poolQuery(`
              select 
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
                    
                end as col_span,
                is_gl,
                is_sh
              from 
                ${table.tb_r_4s_schedule_sign_checkers} 
              where 
                main_schedule_id = '${mainScheduleRealId}' 
                ${whoIs}
              order by
                start_date `
                    )
                }

                const signGl = mainScheduleRealId != null ? (await signCheckerQuery('gl')).rows : []
                const signSh = mainScheduleRealId != null ? (await signCheckerQuery('sh')).rows : []

                result.schedule = await Promise.all(scheduleRows)
                result.sign_checker_gl = mainScheduleRealId != null ? signGl : [];
                result.sign_checker_sh = mainScheduleRealId != null ? signSh : [];
                result.limit = scheduleQuery?.limit ? parseInt(scheduleQuery.limit) : 0;
                result.current_page = scheduleQuery?.current_page ? parseInt(scheduleQuery.current_page) : 0;
                result.total_data = scheduleQuery?.total_data ? parseInt(scheduleQuery.total_data) : 0;

                cacheAdd(cacheKey, result)
            }

            response.success(res, "Success to get 4s sub schedule", result)
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to get 4s sub schedule")
        }
    },
    get4sSubScheduleTodayPlan: async (req, res) => {
        try {
            const { date, line_id, group_id } = req.query

            let filterCondition = []
            let scheduleSql = `
          select * from (
            select
              ${selectSubScheduleSql}  
              , date(tbrcs.plan_time) as plan_check_dt
              , date(tbrcs.actual_time) as actual_check_dt
              , EXTRACT('day' from  tbrcs.plan_time)::real as idxDate
            from
              ${fromSubScheduleSql}
            order by tml.line_nm
          ) a
        `

            if (line_id && line_id != null && line_id != "") {
                filterCondition.push(` line_id = '${line_id}' `)
            }
            if (group_id && group_id != null && group_id != "") {
                filterCondition.push(` line_id = '${group_id}' `)
            }
            if (date && date != null && date != "") {
                filterCondition.push(` plan_check_dt = '${date}' `)
            }

            if (filterCondition.length > 0) {
                filterCondition = filterCondition.join(' and ')
                scheduleSql = scheduleSql.concat(` where ${filterCondition} `)
            }


            const result = (await queryCustom(scheduleSql, false)).rows
            result.map((item) => {
                item.main_schedule_id = item.main_schedule_uuid

                delete item.freq_real_id
                delete item.zone_real_id
                delete item.kanban_real_id
                delete item.pic_real_id
                delete item.main_schedule_uuid

                return item
            })

            response.success(res, "Success to get today activities 4s sub schedule", result)
        } catch (e) {
            console.log(e)
            response.failed(res, "Error to get today activities 4s sub schedule")
        }
    },
    get4sSignCheckerBySignCheckerId: async (req, res) => {
        try {
            const signCheckerUuid = req.params.sign_checker_id

            const signCheckerRows = await queryGET(
                table.tb_r_4s_schedule_sign_checkers,
                `where uuid = '${signCheckerUuid}'`,
                [
                    'uuid as sign_checker_id',
                    'sign',
                    'is_tl_1',
                    'is_tl_2',
                    'is_gl',
                    'is_sh',
                ]
            )

            let result = {}
            if (signCheckerRows) {
                result = signCheckerRows[0] ?? {}
                if (result) {
                    if (!result.is_tl_1) {
                        delete result.is_tl_1
                    }
                    if (!result.is_tl_2) {
                        delete result.is_tl_2
                    }
                    if (!result.is_gl) {
                        delete result.is_gl
                    }
                    if (!result.is_sh) {
                        delete result.is_sh
                    }

                }
            }

            response.success(res, "Success to get 4s sign checker", result)
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to get 4s sign checker")
        }
    },
    getDetail4sSubSchedule: async (req, res) => {
        try {
            const sub_schedule_uuid = req.params.id

            const subScheduleSql = `select 
                                            ${selectSubScheduleSql},
                                            date(tbrcs.plan_time) as plan_time,
                                            date(tbrcs.actual_time) as actual_time
                                          from
                                            ${fromSubScheduleSql}
                                          where
                                            tbrcs.uuid = '${sub_schedule_uuid}'
                                          limit 1`

            let subScheduleQuery = await queryCustom(subScheduleSql, false)
            if (subScheduleQuery.rows.length == 0) {
                throw "Can't find 4s sub schedule with id provided"
            }

            subScheduleQuery = subScheduleQuery.rows[0]

            const sqlItemCheckKanbans = `select
                                                  tmic.uuid as item_check_kanban_id,
                                                  tmk.uuid as kanban_id,
                                                  tmju.uuid as judgment_id,
                                                  trsic.uuid as schedule_item_check_kanban_id,
                                                  tmk.kanban_no,
                                                  tmic.item_check_nm,
                                                  tmic.method,
                                                  tmic.control_point,
                                                  trsic.actual_time::REAL actual_time,
                                                  trsic.checked_date,
                                                  tmju.judgment_nm,
                                                  tmju.is_abnormal,
                                                  trh4ic.standart_time::real as before_standart_time,
                                                  case 
                                                    when trsic.standart_time is not null then 
                                                        trsic.standart_time::real
                                                    else  tmic.standart_time::real
                                                    end as standart_time    
                                              from
                                                  ${table.tb_m_4s_item_check_kanbans} tmic
                                                  join ${table.tb_m_kanbans} tmk on tmic.kanban_id = tmk.kanban_id 
                                                  left join lateral (
                                                    select 
                                                      * 
                                                    from 
                                                      ${table.tb_r_4s_schedule_item_check_kanbans}
                                                    where 
                                                      item_check_kanban_id = tmic.item_check_kanban_id
                                                      and checked_date::date = '${subScheduleQuery.plan_time}'::date
                                                      and deleted_dt is null
                                                    order by
                                                      schedule_item_check_kanban_id desc
                                                    limit 1
                                                  ) trsic on true
                                                  left join ${table.tb_m_judgments} tmju on trsic.judgment_id = tmju.judgment_id
                                                  left join lateral (
                                                      select 
                                                        trh4ick.* 
                                                      from 
                                                        ${table.tb_r_history_4s_item_check_kanbans} trh4ick
                                                        join ${table.tb_r_4s_sub_schedules} tr4ss on trh4ick.sub_schedule_id = tr4ss.sub_schedule_id
                                                      where 
                                                        trh4ick.item_check_kanban_id = tmic.item_check_kanban_id 
                                                        and trh4ick.standart_time is not null
                                                        and tr4ss.plan_time::date < '${subScheduleQuery.plan_time}'::date  /* determine check sheet history should only fetch when created history greater than equal schedule date */
                                                      order by 
                                                        trh4ick.created_dt desc 
                                                      limit 1
                                                  ) trh4ic on true
                                              where
                                                  tmk.kanban_id = '${subScheduleQuery.kanban_real_id}'
                                                  and tmic.deleted_dt is null
                                              order by 
                                                tmic.created_dt`;

            const itemCheckKanbans = await queryCustom(sqlItemCheckKanbans);

            itemCheckKanbans.rows = await Promise.all(itemCheckKanbans.rows.map(async (item) => {
                if (item.schedule_item_check_kanban_id) {
                    const findings = await queryGET(
                        table.v_4s_finding_list,
                        `where 
              deleted_dt is null 
              and schedule_item_check_kanban_id = '${item.schedule_item_check_kanban_id}'
              and sub_schedule_id = '${subScheduleQuery.sub_schedule_id}'`
                    );
                    if (findings.length > 0) {
                        item.findings = findings.map((item) => {
                            item.kaizen_file = item.kaizen_file ? `${process.env.APP_HOST}/file?path=${item.kaizen_file}` : null;
                            return item;
                        }).reverse();
                    } else {
                        item.findings = []
                    }
                } else {
                    item.findings = []
                }

                return item;
            }));

            subScheduleQuery.item_check_kanbans = itemCheckKanbans.rows
            subScheduleQuery.main_schedule_id = subScheduleQuery.main_schedule_uuid

            delete subScheduleQuery.freq_real_id
            delete subScheduleQuery.zone_real_id
            delete subScheduleQuery.kanban_real_id
            delete subScheduleQuery.pic_real_id
            delete subScheduleQuery.main_schedule_uuid

            response.success(res, "Success to get detail 4s sub schedule", subScheduleQuery)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }

    },
    get4sCountTotalSummary: async (req, res) => {
        try {
            const { line_id } = req.query
            let { month, year } = req.query

            if (!month || month == null || month == -1) {
                month = moment().format('MM')
            }

            if (!year || year == null || year == -1) {
                year = moment().format('YYYY')
            }

            const baseSql = (alias, where) => {
                const byLineId = (line_id && line_id != -1) ? `and tr4sms.line_id = (SELECT line_id FROM ${table.tb_m_lines} WHERE uuid = '${line_id}')` : ''

                return `
                select
                     count(*)::real as ${alias}
                 from
                     ${table.tb_r_4s_sub_schedules} tr4sss
                         join ${table.tb_r_4s_main_schedules} tr4sms on tr4sss.main_schedule_id = tr4sms.main_schedule_id
                 where
                         (EXTRACT(month from tr4sss.plan_time), EXTRACT(year from tr4sss.plan_time)) = (${+month},${+year})
                   and   tr4sss.deleted_by IS NULL
                   ${byLineId}
                   ${where}
              `
            }

            const delay = baseSql(
                'delay',
                `and actual_time is null and date(tr4sss.plan_time) < current_date`
            )

            const progress = baseSql(
                'progress',
                `and actual_time is null and date(tr4sss.actual_time) >= current_date`
            )

            const done = baseSql(
                'done',
                `and actual_time is not null and date(tr4sss.actual_time) >= current_date`
            )

            $sql = `
        with 
          delay as (${delay}),
          progress as (${progress}),
          done as (${done})
        select * from delay, progress, done
      `

            let result = (await queryCustom($sql, false)).rows
            if (result.length > 0) {
                result = result[0]
                /* const copy = []
                for (var key of Object.keys(result))
                {
                  copy.push({ [key]: result[key] })
                }

                result = copy */
            } else {
                result = {}
            }

            response.success(res, 'Success to count total summary 4s', result)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    edi4sSubSchedule: async (req, res) => {
        try {
            let schedulRow = await queryCustom(
                `
          select 
            tr4ss.*,
            tr4sm.uuid as main_schedule_uuid,
            tr4sm.group_id,
            tr4sm.line_id,
            tr4sm.year_num ||'-'|| trim(to_char(tr4sm.month_num, '00')) as month_year_num
          from 
            ${table.tb_r_4s_sub_schedules} tr4ss
            join ${table.tb_r_4s_main_schedules} tr4sm on tr4ss.main_schedule_id = tr4sm.main_schedule_id
          where 
            sub_schedule_id = (select sub_schedule_id from ${table.tb_r_4s_sub_schedules} where uuid = '${req.params.id}' limit 1)
        `
            )

            if (schedulRow.rows.length == 0) {
                response.failed(
                    res,
                    "Error to edit 4s planning schedule, can't find schedule data"
                )
                return
            }

            schedulRow = schedulRow.rows[0]

            const body = {}
            if (req.body.pic_id) {
                body.pic_id = ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.pic_id}') `
            }

            if (req.body.actual_pic_id) {
                body.actual_pic_id = ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.actual_pic_id}') `
            }

            if (req.body.actual_date) {
                body.actual_time = req.body.actual_date
            }

            await queryTransaction(async (db) => {
                const attrsUpdate = await attrsUserUpdateData(req, body)
                let updateCondition = `
            main_schedule_id = '${schedulRow.main_schedule_id}' 
            and freq_id = '${schedulRow.freq_id}' 
            and zone_id = '${schedulRow.zone_id}' 
            and kanban_id = '${schedulRow.kanban_id}'
          `

                await queryPutTransaction(
                    db,
                    table.tb_r_4s_sub_schedules,
                    attrsUpdate,
                    `WHERE sub_schedule_id = (select sub_schedule_id from ${table.tb_r_4s_sub_schedules} where uuid = '${req.params.id}' limit 1)`
                );

                if (req.body.plan_date && req.body.before_plan_date) {
                    //#region update plan_date validation
                    const planDateUpdate = moment(req.body.plan_date, 'YYYY-MM-DD')
                    const previousDate = moment(req.body.before_plan_date, 'YYYY-MM-DD')

                    if (planDateUpdate.month() < previousDate.month() || planDateUpdate.year() < previousDate.year()) {
                        throw "Can't edit schedule plan on previous date"
                    }
                    //#endregion

                    let newMainScheduleSet = ''
                    let newMainScheduleRealId = null
                    if (planDateUpdate.month() > previousDate.month()) {
                        const checkHeaderNextMonth = await db.query(`
              select 
                * 
              from 
                ${table.tb_r_4s_main_schedules} 
              where 
                year_num = '${planDateUpdate.year()}' 
                and month_num = '${planDateUpdate.month() + 1}'
                and line_id = '${schedulRow.line_id}'
                and group_id = '${schedulRow.group_id}'
              `)

                        if (checkHeaderNextMonth.rowCount == 0) {
                            const newMainSchedule = await db.query(`
                insert into ${table.tb_r_4s_main_schedules}
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

                            newMainScheduleSet = `, main_schedule_id = '${newMainSchedule.rows[0].main_schedule_id}'`
                            newMainScheduleRealId = newMainSchedule.rows[0].main_schedule_id
                        } else {
                            newMainScheduleSet = `, main_schedule_id = '${checkHeaderNextMonth.rows[0].main_schedule_id}'`
                            newMainScheduleRealId = checkHeaderNextMonth.rows[0].main_schedule_id
                        }
                    }

                    const byScheduleIdPlanDateSql = `and schedule_id = (select schedule_id from ${table.tb_m_schedules} where "date" = '${req.body.plan_date}')`
                    const byScheduleIdPreviousDateSql = `and schedule_id = (select schedule_id from ${table.tb_m_schedules} where "date" = '${req.body.before_plan_date}')`

                    const sqlUpdateNewPlanDate = (newMainScheduleSet = '') => {
                        const s = `
              update 
                ${table.tb_r_4s_sub_schedules} 
              set 
                plan_time = '${req.body.plan_date}'
                ${newMainScheduleSet} 
              where 
                ${updateCondition} 
                ${byScheduleIdPlanDateSql}   
            `

                        console.log('sqlUpdateNewPlanDate', s);
                        return s
                    }

                    const sqlUpdateOldPlanDate = () => {
                        const s = `
              update 
                ${table.tb_r_4s_sub_schedules} 
              set 
                plan_time = null
              where 
                ${updateCondition} 
                ${byScheduleIdPreviousDateSql}`

                        console.log('sqlUpdateOldPlanDate', s);
                        return s
                    }

                    // updating previous plan date
                    await db.query(sqlUpdateOldPlanDate())

                    if (newMainScheduleSet == '') {
                        //#region  update plan_date and previous plan_date
                        const findNightShift = await db.query(`
            select 
              * 
            from 
              ${table.tb_r_4s_sub_schedules} 
            where 
              ${updateCondition} 
              and schedule_id = (select schedule_id from ${table.tb_m_schedules} where "date" = '${req.body.plan_date}')
              and shift_type = 'night_shift'`)

                        if (findNightShift.rowCount > 0) {
                            throw "Can't edit schedule plan on night shift"
                        }

                        // updating new plan date
                        await db.query(sqlUpdateNewPlanDate())

                        //#endregion
                    } else {
                        //find previous 1 month schedule, used previous updatecondition value before reinit
                        const findAvailPlanTimeSql = `select 
                                            * 
                                          from 
                                            ${table.tb_r_4s_sub_schedules} 
                                          where 
                                            ${updateCondition}
                                            and plan_time is not null`
                        console.log('findAvailPlanTimeSql', findAvailPlanTimeSql);
                        const findAvailPlanTimeQuery = await db.query(findAvailPlanTimeSql)
                        console.log('findAvailPlanTime lenght', findAvailPlanTimeQuery.rowCount);
                        if (findAvailPlanTimeQuery.rowCount == 0) {
                            //delete if plan time null
                            await db.query(`delete from ${table.tb_r_4s_sub_schedules} where ${updateCondition}`)
                        }

                        updateCondition = `main_schedule_id = '${newMainScheduleRealId}' 
                and freq_id = '${schedulRow.freq_id}' 
                and zone_id = '${schedulRow.zone_id}' 
                and kanban_id = '${schedulRow.kanban_id}'`

                        //#region check month and year updated plan_date by mandatory id
                        const monthlyPlanSql = `
              select 
                * 
              from 
                ${table.tb_r_4s_sub_schedules} 
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
                        const monthlyPlanQuery = await db.query(monthlyPlanSql)
                        //#endregion

                        if (monthlyPlanQuery.rowCount == 0) {
                            const currentMonthDays = await shiftByGroupId(db, planDateUpdate.year(), planDateUpdate.month() + 1, schedulRow.line_id, schedulRow.group_id)
                            const singleKanbanSchedule = await genSingleMonthlySubScheduleSchema(
                                {
                                    kanban_id: schedulRow.kanban_id,
                                    zone_id: schedulRow.zone_id,
                                    freq_id: schedulRow.freq_id,
                                    main_schedule_id: newMainScheduleRealId
                                },
                                {
                                    line_id: schedulRow.line_id,
                                    group_id: schedulRow.group_id,
                                },
                                currentMonthDays,
                                moment(planDateUpdate).format('YYYY-MM-DD')
                            )

                            const signCheckerScheduleSchema = await genSingleSignCheckerSqlFromSchema(
                                db,
                                planDateUpdate.year(),
                                planDateUpdate.month() + 1,
                                {
                                    line_id: schedulRow.line_id,
                                    group_id: schedulRow.group_id,
                                },
                                currentMonthDays,
                                newMainScheduleRealId
                            )

                            if (singleKanbanSchedule.columns.length > 0) {
                                const sqlInSubSchedule = `insert into ${table.tb_r_4s_sub_schedules} (${singleKanbanSchedule.columns}) values ${singleKanbanSchedule.values}`
                                console.log('sqlInSubSchedule', sqlInSubSchedule);
                                await db.query(sqlInSubSchedule)
                            }

                            if (signCheckerScheduleSchema.columns.length > 0) {
                                const sqlInSignChecker = `insert into ${table.tb_r_4s_schedule_sign_checkers} (${signCheckerScheduleSchema.columns}) values ${signCheckerScheduleSchema.values}`
                                console.log('sqlInSignChecker', sqlInSignChecker);
                                await db.query(sqlInSignChecker)
                            }
                        } else {
                            // updating previous plan date
                            await db.query(sqlUpdateOldPlanDate())

                            // updating new plan date
                            await db.query(sqlUpdateNewPlanDate(newMainScheduleSet))
                        }
                    }
                }
            })

            cacheDelete(subScheduleCacheKey(schedulRow.main_schedule_uuid))

            response.success(res, "Success to edit 4s schedule plan", [])
        } catch (e) {
            console.log(e)
            response.failed(res, e)
        }
    },
    sign4sSchedule: async (req, res) => {
        try {

            const sign_checker_id = req.params.sign_checker_id
            if (sign_checker_id.toLowerCase() === "createnew") {
                const date = req.body.date;
                const attrsInsert = await attrsUserInsertData(req, req.body);
                if (new Map(Object.entries(attrsInsert)).has('date')) {
                    delete attrsInsert.date;
                }

                await queryPOST(
                    table.tb_r_4s_schedule_sign_checkers,
                    {
                        ...attrsInsert,
                        uuid: uuid(),
                        main_schedule_id: `(select main_schedule_id from ${table.tb_r_4s_main_schedules} where uuid = '${req.body.main_schedule_id}')`,
                        start_date: date,
                        end_date: date,
                        sign: req.body.sign,
                        is_tl_1: req.body.is_tl_1,
                        is_gl: req.body.is_gl,
                        is_sh: req.body.is_sh,
                    }
                );

                response.success(res, 'success to sign 4s schedule', [])
                return;
            }

            let signCheckerQuery = await queryCustom(
                `
          select
            tr4ssc.sign,
            tr4ssc.is_tl_1,
            tr4ssc.is_tl_2,
            tr4ssc.is_gl,
            tr4ssc.is_sh,
            tr4sm.uuid as main_schedule_uuid
          from
            ${table.tb_r_4s_schedule_sign_checkers} tr4ssc
            join ${table.tb_r_4s_main_schedules} tr4sm on tr4ssc.main_schedule_id = tr4sm.main_schedule_id
          where 
            tr4ssc.uuid = '${sign_checker_id}'
        `,
                false
            )

            if (!signCheckerQuery || signCheckerQuery.length == 0) {
                throw "invalid params, unknown data"
            }

            delete req.body.main_schedule_id
            delete req.body.date
            delete req.body.is_tl_1
            delete req.body.is_tl_2
            delete req.body.is_gl
            delete req.body.is_sh

            let attrsUpdate = await attrsUserUpdateData(req, req.body)
            await queryPUT(table.tb_r_4s_schedule_sign_checkers, attrsUpdate, `WHERE uuid = '${sign_checker_id}'`)

            cacheDelete(signCheckerQuery.rows[0].main_schedule_uuid)

            response.success(res, 'success to sign 4s schedule', [])
        } catch (e) {
            console.log(e)
            response.failed(res, "Error to sign 4s schedule")
        }
    },
    delete4sMainSchedule: async (req, res) => {
        try {
            let obj = {
                deleted_dt: "CURRENT_TIMESTAMP",
                deleted_by: req.user.fullname
            }

            await queryPUT(table.tb_r_4s_main_schedules, obj, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'success to delete 4s main schedule', [])
        } catch (e) {
            console.log(e)
            response.failed(res, "Error to delete 4s main schedule")
        }
    },
    delete4sSubSchedule: async (req, res) => {
        try {
            let subScheduleRow = await queryCustom(
                `
          select 
            tr4ss.*,
            tr4sm.uuid as main_schedule_uuid,
            tr4sm.group_id,
            tr4sm.line_id,
            tr4sm.year_num ||'-'|| trim(to_char(tr4sm.month_num, '00')) as month_year_num
          from 
            ${table.tb_r_4s_sub_schedules} tr4ss
            join ${table.tb_r_4s_main_schedules} tr4sm on tr4ss.main_schedule_id = tr4sm.main_schedule_id
          where 
            tr4ss.uuid = '${req.params.id}'
        `
            )

            if (!subScheduleRow) {
                response.failed(
                    res,
                    "Error to delete 4s sub schedule, can't find schedule data"
                )
                return
            }

            subScheduleRow = subScheduleRow.rows[0]

            const transaction = await queryTransaction(async (db) => {
                const updateCondition = `main_schedule_id = '${subScheduleRow.main_schedule_id}' 
            and freq_id = '${subScheduleRow.freq_id}' 
            and zone_id = '${subScheduleRow.zone_id}' 
            and kanban_id = '${subScheduleRow.kanban_id}'
            and schedule_id = '${subScheduleRow.schedule_id}'`

                const updateSql = `update ${table.tb_r_4s_sub_schedules}
                            set 
                              plan_time = null,
                              actual_time = null,
                              actual_pic_id = null,
                              changed_by = '${req.user.fullname}',
                              changed_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}'
                            where
                              ${updateCondition}
                            returning *`;
                let result = await db.query(updateSql);
                if (result.rowCount) {
                    result = result.rows[0];
                }

                //region find previous 1 month schedule, used previous updatecondition value before reinit
                /*const findAvailPlanTimeSql = `select
                                                *
                                              from
                                                ${table.tb_r_4s_sub_schedules}
                                              where
                                                ${updateCondition}
                                                and plan_time is not null`
                console.log('findAvailPlanTimeSql', findAvailPlanTimeSql);
                const findAvailPlanTimeQuery = await db.query(findAvailPlanTimeSql)
                console.log('findAvailPlanTime lenght', findAvailPlanTimeQuery.rowCount);
                if (findAvailPlanTimeQuery.rowCount == 0)
                {
                  //delete if plan time null
                  await db.query(`delete from ${table.tb_r_4s_sub_schedules} where ${updateCondition}`)
                }*/
                //endregion

                //region delete itemcheck kanban & finding
                await db.query(`delete from ${table.tb_r_4s_findings} where sub_schedule_id = '${result.sub_schedule_id}'`);
                await db.query(`delete from ${table.tb_r_4s_schedule_item_check_kanbans} where sub_schedule_id = '${result.sub_schedule_id}'`);
                //endregion

                return result
            });

            cacheDelete(subScheduleCacheKey(subScheduleRow.main_schedule_uuid))

            response.success(res, 'success to delete 4s sub schedule', transaction)
        } catch (e) {
            console.log(e)
            response.failed(res, "Error to delete 4s sub schedule")
        }
    },
    add4sSubPlanPic: async (req, res) => {
        try {
            let sub_schedule_id = req.params.id
            const result = await queryPUT(table.tb_r_4s_sub_schedules, {
                pic_id: `(select user_id from ${table.tb_m_users} where uuid = '${req.body.pic_id}')`,
                changed_by: req.user.fullname,
                changed_dt: moment().format('YYYY-MM-DD HH:mm:ss')
            }, `where uuid = '${sub_schedule_id}'`)
            console.log(result.rows[0]);

            const { created_dt } = result.rows[0]
            await queryCustom(`
                UPDATE tb_r_4s_sub_schedules s
                SET pic_id = src.pic_id
                FROM (
                    SELECT kanban_id, 
                        DATE_PART('month', created_dt) AS month_start,
                        DATE_PART('year', created_dt) AS year_start,
                        MAX(pic_id) AS pic_id
                    FROM tb_r_4s_sub_schedules
                    WHERE 
                        pic_id IS NOT NULL and 
                        DATE_PART('month', created_dt) = ${moment(created_dt).format('M')} and 
                        DATE_PART('year', created_dt) = ${moment(created_dt).format('YYYY')}
                    GROUP BY kanban_id, DATE_PART('month', created_dt), DATE_PART('year', created_dt)
                ) src
                WHERE s.kanban_id = src.kanban_id
                AND DATE_PART('month', s.plan_time) = src.month_start
                AND DATE_PART('year', plan_time) = src.year_start
                AND (s.pic_id IS NULL)
            `)
            response.success(res, 'Success to add plan pic 4s sub schedule', [])
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to add plan pic 4s sub schedule")
        }
    }
}
