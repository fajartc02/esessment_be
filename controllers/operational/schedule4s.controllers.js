const table = require("../../config/table")
const {
  queryCustom,
  queryGET,
  queryPUT,
  queryTransaction,
  queryPutTransaction,
  queryPostTransaction
} = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const { arrayOrderBy, objToString } = require("../../helpers/formatting")
const moment = require('moment')
const logger = require('../../helpers/logger')
const { cacheGet, cacheAdd, cacheDelete } = require('../../helpers/cacheHelper')
const { uuid } = require("uuidv4")
const { generateMonthlyDates } = require('../../helpers/date')

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
  'tbrcs.actual_time',
  'tmf.freq_nm',
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
  if (planPicRealId)
  {
    byPic = ` and tbrcs.pic_id = '${planPicRealId}' `
  }

  let childrenSql = `
              select * from (
                 select
                    tbrcs.uuid as sub_schedule_id,
                    trcc1.tl1_sign_checker_id,
                    trcc2.tl2_sign_checker_id,
                    tmsc.date,
                    EXTRACT('Day' FROM tmsc.date)::INTEGER as date_num,
                    tmsc.is_holiday or tbrcs.shift_type is null as is_holiday, -- null of shift_type was set as holiday from monthly scheduler 
                    case
                      when item_check.total_checked > 0 and finding.finding_id is not null then
                        'PROBLEM'
                      when item_check.total_checked > 0 and tbrcs.plan_time is not null then
                        'ACTUAL'
                      when tbrcs.shift_type = 'night_shift' then
                        'NIGHT_SHIFT'
                      when tbrcs.plan_time is not null then
                        'PLANNING'
                    end as status,
                    trcc1.sign as sign_tl_1,
                    trcc2.sign as sign_tl_2
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
                                        select
                                          uuid as tl2_sign_checker_id,
                                          sign
                                        from
                                          ${table.tb_r_4s_schedule_sign_checkers}
                                        where
                                          main_schedule_id = tbrcs.main_schedule_id
                                          and is_tl_2 = true 
                                          and end_date = tmsc."date"
                                        limit 1
                      ) trcc2 on true
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
                                                      kanban_id = '${kanbanRealId}')
                                                      and main_schedule_id = tbrcs.main_schedule_id
                      ) item_check on true
                  where
                      tbrcs.deleted_dt is null
                      and tbrcs.main_schedule_id = ${mainScheduleRealId}
                      and tbrcs.freq_id = '${freqRealId}'
                      and tbrcs.zone_id = '${zoneRealId}'
                      and tbrcs.kanban_id = '${kanbanRealId}'
                      ${byPic}
              ) a order by date_num      
           `
  //console.warn('childrensql', childrenSql)
  //logger(childrenSql, 'childrenSql')
  const children = await queryCustom(childrenSql, false)

  return children.rows
}

const subScheduleCacheKey = (
  main_schedule_id,
  freq_id = null,
  zone_id = null,
  kanban_id = null,
  line_id = null,
  group_id = null,
  month_year_num = null
) => {
  const obj = {
    main_schedule_id: main_schedule_id
  }

  if (freq_id)
  {
    obj.freq_id = freq_id
  }
  if (zone_id)
  {
    obj.zone_id = zone_id
  }
  if (kanban_id)
  {
    obj.kanban_id = kanban_id
  }
  if (line_id)
  {
    obj.line_id = line_id
  }
  if (group_id)
  {
    obj.group_id = group_id
  }
  if (month_year_num)
  {
    obj.month_year_num = month_year_num
  }

  return objToString(obj)
}

module.exports = {
  get4sMainSchedule: async (req, res) => {
    try
    {
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

      if (line_id && line_id != null && line_id != "")
      {
        filterCondition.push(` trcp.line_id = (select line_id from ${table.tb_m_lines} where uuid = '${line_id}') `)
      }
      if (month_year_num && month_year_num != null && month_year_num != "")
      {
        let MYFilterSplit = month_year_num.split('-')
        if (MYFilterSplit.length == 1)
        {
          if (MYFilterSplit[0].length == 4)
          {
            filterCondition.push(` trcp.year_num = '${MYFilterSplit[0]}}' `)
          }
          else
          {
            filterCondition.push(` trcp.month_num = '${parseInt(MYFilterSplit[0])}}' `)
          }
        }
        else
        {
          filterCondition.push(` trcp.year_num || '-' || trcp.month_num = '${MYFilterSplit[0]}-${parseInt(MYFilterSplit[1])}' `)
        }
      }
      if (group_id && group_id != null && group_id != "")
      {
        filterCondition.push(` trcp.group_id = (select group_id from ${table.tb_m_groups} where uuid = '${group_id}') `)
      }

      const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
      const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

      filterCondition = filterCondition.join(' and ')
      mainScheduleSql = mainScheduleSql.concat(` ${filterCondition} `)
      mainScheduleSql = mainScheduleSql.concat(` order by trcp.created_dt ${qLimit} ${qOffset} `)

      const mainScheduleQuery = await queryCustom(mainScheduleSql)
      let result = mainScheduleQuery.rows

      if (result.length > 0)
      {
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
    } catch (error)
    {
      console.log(error)
      response.failed(res, "Error to get 4s main schedule")
    }
  },
  get4sSubSchedule: async (req, res) => {
    try
    {
      const { main_schedule_id, freq_id, zone_id, kanban_id, line_id, group_id, month_year_num } = req.query
      const cacheKey = subScheduleCacheKey(main_schedule_id, freq_id, zone_id, kanban_id, line_id, group_id, month_year_num);
      const cachedSchedule = cacheGet(cacheKey)

      if (cachedSchedule)
      {
        console.log('get4sSubSchedule fetch from cached');
        response.success(res, "Success to get 4s sub schedule", cachedSchedule)
        return
      }

      console.log('get4sSubSchedule fetch from query');

      if (
        !main_schedule_id ||
        main_schedule_id == "" ||
        main_schedule_id == null ||
        main_schedule_id == "0"
      )
      {
        response.failed(res, "Error to get 4s main schedule id not provide")
        return
      }

      let result = {
        schedule: [],
        sign_checker_gl: [],
        sign_checker_sh: []
      }

      const whereMainSchedule = `(select main_schedule_id from ${table.tb_r_4s_main_schedules} where uuid = '${main_schedule_id}')`

      let scheduleSql = `
          select * from (
            select distinct on (tbrcs.freq_id, tbrcs.zone_id, tbrcs.kanban_id)
              ${selectSubScheduleSql}  
          from
             ${fromSubScheduleSql}
          where
            tbrcs.main_schedule_id = ${whereMainSchedule}
          ) a 
          where
            1 = 1
        `

      let filterCondition = []

      if (freq_id && freq_id != null && freq_id != "")
      {
        filterCondition.push(` freq_id = '${freq_id}' `)
      }
      if (zone_id && zone_id != null && zone_id != "")
      {
        filterCondition.push(` zone_id = '${zone_id}' `)
      }
      if (kanban_id && kanban_id != null && kanban_id != "")
      {
        filterCondition.push(` kanban_id = '${kanban_id}' `)
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

      scheduleSql = scheduleSql.concat(` 
            order by 
            case freq_nm 
              when 'Day' then 1
              when '1 Week' then 2
              when '1 Month' then 3
            end 
          `
      )

      //console.log('scheduleSql', scheduleSql)
      //logger(scheduleSql, 'schedule')
      const scheduleQuery = await queryCustom(scheduleSql, false)

      if (scheduleQuery.rows && scheduleQuery.rows.length > 0)
      {
        let mainScheduleRealId = null

        const scheduleRows = scheduleQuery.rows.map(async (item) => {
          mainScheduleRealId = item.main_schedule_id

          const whereFreqId = ` ((select freq_id from ${table.tb_m_freqs} where uuid = '${item.freq_id}' limit 1)) `

          const countRowSpanSql =
            `
              with
                  pics as (
                      select
                          count(distinct kanban_id)::integer as pic_rows
                      from
                          ${table.tb_r_4s_sub_schedules}
                      where
                          pic_id = (select user_id from ${table.tb_m_users} where uuid = '${item.pic_id}' limit 1)
                          and freq_id = ${whereFreqId}
                      group by
                          pic_id
                  ),
                  zones as (
                      select
                          count(distinct kanban_id)::integer as zone_rows
                      from
                          ${table.tb_r_4s_sub_schedules}
                      where
                          zone_id = (select zone_id from ${table.tb_m_zones} where uuid = '${item.zone_id}' limit 1)
                          and freq_id = ${whereFreqId}
                      group by
                          zone_id
                  ),
                  freqs as (
                      select
                          count(distinct kanban_id)::integer as freq_rows
                      from
                          ${table.tb_r_4s_sub_schedules}
                      where
                          freq_id = ${whereFreqId}
                      group by
                          freq_id
                  )
                  select * from 
                    pics 
                    full outer join zones on true 
                    full outer join freqs on true
          `

          //console.log('countRowSpanSql', countRowSpanSql)
          const countRowSpanQuery = await queryCustom(countRowSpanSql, false)

          let countRows = countRowSpanQuery.rows
          if (countRows && countRows.length > 0)
          {
            countRows = countRows[0]
            item.row_span_pic = countRows.pic_rows ?? 1
            item.row_span_freq = countRows.freq_rows ?? 1
            item.row_span_zone = countRows.zone_rows ?? 1
          } else
          {
            item.row_span_pic = 1
            item.row_span_freq = 1
            item.row_span_zone = 1
          }

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
          if (who == 'gl')
          {
            whoIs = 'and is_gl = true'
          } else if (who == 'sh')
          {
            whoIs = 'and is_sh = true'
          }

          return await queryCustom(`
              select 
                uuid as sign_checker_id,
                sign,
                start_date,
                end_date,
                (end_date - start_date)::integer + 1 as col_span
              from 
                ${table.tb_r_4s_schedule_sign_checkers} 
              where 
                main_schedule_id = '${mainScheduleRealId}' 
                ${whoIs}
              order by
                start_date
            `, false)
        }

        const signGl = (await signCheckerQuery('gl')).rows
        const signSh = (await signCheckerQuery('sh')).rows

        const addHolidayTemp = async (signArr) => {
          const holidayTemp = []
          for (let i = 0; i < signGl.length; i++)
          {
            if (signArr[i + 1])
            {
              const holidaySchedule = await queryCustom(
                `
                                select 
                                    * 
                                from 
                                    ${table.tb_m_schedules} 
                                where 
                                    is_holiday = true 
                                    and date between '${signArr[i].end_date}' and '${signArr[i + 1].start_date}'
                            `,
                false
              )

              for (let j = 0; j < holidaySchedule.rows.length; j++)
              {
                holidayTemp.push({
                  index: i + 1,
                  main_schedule_id: main_schedule_id,
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
            signArr.splice(holidayTemp[i].index, 0, holidayTemp[i])
          }

          return arrayOrderBy(signArr, (s) => s.start_date)
        }


        result.schedule = await Promise.all(scheduleRows)
        result.sign_checker_gl = await addHolidayTemp(signGl)
        result.sign_checker_sh = await addHolidayTemp(signSh)

        cacheAdd(cacheKey, result)
      }

      response.success(res, "Success to get 4s sub schedule", result)
    } catch (error)
    {
      console.log(error)
      response.failed(res, "Error to get 4s sub schedule")
    }
  },
  get4sSubScheduleTodayPlan: async (req, res) => {
    try
    {
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

      if (line_id && line_id != null && line_id != "")
      {
        filterCondition.push(` line_id = '${line_id}' `)
      }
      if (group_id && group_id != null && group_id != "")
      {
        filterCondition.push(` line_id = '${group_id}' `)
      }
      if (date && date != null && date != "")
      {
        filterCondition.push(` plan_check_dt = '${date}' `)
      }

      if (filterCondition.length > 0)
      {
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
    }
    catch (e)
    {
      console.log(e)
      response.failed(res, "Error to get today activities 4s sub schedule")
    }
  },
  get4sSignCheckerBySignCheckerId: async (req, res) => {
    try
    {
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
      if (signCheckerRows)
      {
        result = signCheckerRows[0] ?? {}
        if (result)
        {
          if (!result.is_tl_1)
          {
            delete result.is_tl_1
          }
          if (!result.is_tl_2)
          {
            delete result.is_tl_2
          }
          if (!result.is_gl)
          {
            delete result.is_gl
          }
          if (!result.is_sh)
          {
            delete result.is_sh
          }
        }
      }

      response.success(res, "Success to get 4s sign checker", result)
    } catch (error)
    {
      console.log(error)
      response.failed(res, "Error to get 4s sign checker")
    }
  },
  getDetail4sSubSchedule: async (req, res) => {
    try
    {
      const sub_schedule_uuid = req.params.id

      const subScheduleSql = `
          select 
            ${selectSubScheduleSql},
            date(tbrcs.plan_time) as plan_time,
            date(tbrcs.actual_time) as actual_time
          from
            ${fromSubScheduleSql}
          where
            tbrcs.uuid = '${sub_schedule_uuid}'
          limit 1
        `

      let subScheduleQuery = await queryCustom(subScheduleSql, false)
      if (subScheduleQuery.rows.length == 0)
      {
        throw "Can't find 4s sub schedule with id provided"
      }

      subScheduleQuery = subScheduleQuery.rows[0]

      const itemCheckKanbans = await queryCustom(
        `
          select
              tmic.uuid as item_check_kanban_id,
              tmk.uuid as kanban_id,
              tmju.uuid as judgment_id,
              trsic.uuid as schedule_item_check_kanban_id,
              tmk.kanban_no,
              tmic.item_check_nm,
              tmic.method,
              tmic.control_point,
              tmic.standart_time::REAL as standart_time,
              trsic.actual_time::REAL actual_time,
              trsic.checked_date,
              tmju.judgment_nm,
              tmju.is_abnormal
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
                  and date_part('month', checked_date) = ${subScheduleQuery.month_num}
                  and date_part('year', checked_date) = ${subScheduleQuery.year_num}
                order by
                  schedule_item_check_kanban_id desc
                limit 1
              ) trsic on true
              left join ${table.tb_m_judgments} tmju on trsic.judgment_id = tmju.judgment_id
          where
              tmk.kanban_id = '${subScheduleQuery.kanban_real_id}'
        `
      )

      itemCheckKanbans.rows = await Promise.all(itemCheckKanbans.rows.map(async (item) => {
        if (item.schedule_item_check_kanban_id)
        {
          const findings = await queryGET(
            table.v_4s_finding_list,
            `where 
              deleted_dt is null 
              and schedule_item_check_kanban_id = '${item.schedule_item_check_kanban_id}'
              and sub_schedule_id = '${subScheduleQuery.sub_schedule_id}'`
          )
          if (findings.length > 0)
          {
            item.findings = findings
          }
          else
          {
            item.findings = []
          }
        }
        else
        {
          item.findings = []
        }

        return item
      }))

      subScheduleQuery.item_check_kanbans = itemCheckKanbans.rows
      subScheduleQuery.main_schedule_id = subScheduleQuery.main_schedule_uuid

      delete subScheduleQuery.freq_real_id
      delete subScheduleQuery.zone_real_id
      delete subScheduleQuery.kanban_real_id
      delete subScheduleQuery.pic_real_id
      delete subScheduleQuery.main_schedule_uuid

      response.success(res, "Success to get detail 4s sub schedule", subScheduleQuery)
    }
    catch (error)
    {
      console.log(error)
      response.failed(res, error)
    }
  },
  get4sCountTotalSummary: async (req, res) => {
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

      response.success(res, 'Success to count total summary 4s', result)
    }
    catch (error)
    {
      console.log(error)
      response.failed(res, error)
    }
  },
  edi4sSubSchedule: async (req, res) => {
    try
    {
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

      if (schedulRow.rows.length == 0)
      {
        response.failed(
          res,
          "Error to edit 4s planning schedule, can't find schedule data"
        )
        return
      }

      schedulRow = schedulRow.rows[0]

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
          `WHERE ${updateCondition}`
        )

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
          if (planDateUpdate.month() > previousDate.month())
          {
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

            if (checkHeaderNextMonth.rowCount == 0)
            {
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
            }
            else
            {
              newMainScheduleSet = `, main_schedule_id = '${checkHeaderNextMonth.rows[0].main_schedule_id}'`
            }
          }


          if (newMainScheduleSet == '')
          {
            //#region  update plan_date and previous plan_date
            const findNightShift = await db.query(`
            select 
              * 
            from 
              ${table.tb_r_4s_sub_schedules} 
            where 
              ${updateCondition} 
              and schedule_id = (select schedule_id from ${table.tb_m_schedules} where "date" = '${req.body.plan_date}')
              and shift_type = 'night_shift'
          `)

            if (findNightShift.rowCount > 0)
            {
              throw "Can't edit schedule plan on night shift"
            }

            const byScheduleIdPlanDateSql = `and schedule_id = (select schedule_id from ${table.tb_m_schedules} where "date" = '${req.body.plan_date}')`
            const byScheduleIdPreviousDateSql = `and schedule_id = (select schedule_id from ${table.tb_m_schedules} where "date" = '${req.body.before_plan_date}')`

            // updating new plan date
            const sqlUpdateNewPlanDate = `
              update 
                ${table.tb_r_4s_sub_schedules} 
              set 
                plan_time = '${req.body.plan_date}'
                ${newMainScheduleSet} 
              where 
                ${updateCondition} 
                ${byScheduleIdPlanDateSql}
                
            `
            console.log('sqlUpdateNewPlanDate', sqlUpdateNewPlanDate);
            await db.query(sqlUpdateNewPlanDate)

            // updating previous plan date
            const sqlUpdateOldPlanDate = `
              update 
                ${table.tb_r_4s_sub_schedules} 
              set 
                plan_time = null
              where 
                ${updateCondition} 
                ${byScheduleIdPreviousDateSql}
            `
            console.log('sqlUpdateOldPlanDate', sqlUpdateOldPlanDate);
            await db.query(sqlUpdateOldPlanDate)
            //#endregion
          }
          else
          {
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

            if (monthlyPlanQuery.rowCount == 0)
            {
              const currentMonthDays = generateMonthlyDates(planDateUpdate.year(), planDateUpdate.month())
              for (let i = 0; i < currentMonthDays.length; i++)
              {
                
              }
            }

          }
        }
      })

      cacheDelete(subScheduleCacheKey(schedulRow.main_schedule_uuid))

      response.success(res, "Success to edit 4s schedule plan", [])
    } catch (e)
    {
      console.log(e)
      response.failed(res, e)
    }
  },
  sign4sSchedule: async (req, res) => {
    try
    {
      const sign_checker_id = req.params.sign_checker_id

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

      if (!signCheckerQuery || signCheckerQuery.length == 0)
      {
        throw "invalid params, unknown data"
      }

      let attrsUpdate = await attrsUserUpdateData(req, req.body)
      await queryPUT(table.tb_r_4s_schedule_sign_checkers, attrsUpdate, `WHERE uuid = '${sign_checker_id}'`)

      cacheDelete(signCheckerQuery.rows[0].main_schedule_uuid)

      response.success(res, 'success to sign 4s schedule', [])
    } catch (e)
    {
      console.log(e)
      response.failed(res, "Error to sign 4s schedule")
    }
  },
  delete4sMainSchedule: async (req, res) => {
    try
    {
      let obj = {
        deleted_dt: "CURRENT_TIMESTAMP",
        deleted_by: req.user.fullname
      }

      await queryPUT(table.tb_r_4s_main_schedules, obj, `WHERE uuid = '${req.params.id}'`)
      response.success(res, 'success to delete 4s main schedule', [])
    } catch (e)
    {
      console.log(e)
      response.failed(res, "Error to delete 4s main schedule")
    }
  },
  delete4sSubSchedule: async (req, res) => {
    try
    {
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

      if (!subScheduleRow)
      {
        response.failed(
          res,
          "Error to delete 4s sub schedule, can't find schedule data"
        )
        return
      }

      subScheduleRow = subScheduleRow.rows[0]

      const result = await queryCustom(
        `
          update ${table.tb_r_4s_sub_schedules}
          set 
            plan_time = null,
            actual_time = null,
            actual_pic_id = null,
            changed_by = '${req.user.fullname}',
            changed_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}'
          where
            main_schedule_id = '${subScheduleRow.main_schedule_id}' 
            and freq_id = '${subScheduleRow.freq_id}' 
            and zone_id = '${subScheduleRow.zone_id}' 
            and kanban_id = '${subScheduleRow.kanban_id}'
            and schedule_id = '${subScheduleRow.schedule_id}'
          returning *
        `
      )

      cacheDelete(subScheduleCacheKey(subScheduleRow.main_schedule_uuid))

      response.success(res, 'success to delete 4s sub schedule', result.rows[0])
    } catch (e)
    {
      console.log(e)
      response.failed(res, "Error to delete 4s sub schedule")
    }
  },
}
