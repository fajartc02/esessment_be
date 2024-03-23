const table = require("../../config/table")
const {
  queryPOST,
  queryBulkPOST,
  queryCustom,
  queryGET,
  queryPUT,
  queryTransaction,
  queryPutTransaction
} = require("../../helpers/query")

const response = require("../../helpers/response")
const getLastIdData = require("../../helpers/getLastIdData")
const uuidToId = require("../../helpers/uuidToId")
const idToUuid = require("../../helpers/idToUuid")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUuidToIds = require("../../helpers/multipleUuidToId")
const { padTwoDigits } = require("../../helpers/formatting")

const fromSubScheduleSql = `
    ${table.tb_r_4s_sub_schedules} tbrcs
    join ${table.tb_r_4s_main_schedules} trmsc on tbrcs.main_schedule_id = trmsc.main_schedule_id
    left join ${table.tb_m_users} tmu on tmu.user_id = tbrcs.pic_id
    join ${table.tb_m_kanbans} tmk on tbrcs.kanban_id = tmk.kanban_id
    join ${table.tb_m_zones} tmz on tbrcs.zone_id = tmz.zone_id
    join ${table.tb_m_freqs} tmf on tbrcs.freq_id = tmf.freq_id
    join ${table.tb_m_schedules} tmsc on tbrcs.schedule_id = tmsc.schedule_id
`

const selectSubScheduleCol = [
  'tbrcs.main_schedule_id',
  'trmsc.uuid as main_schedule_uuid',
  'tbrcs.uuid as sub_schedule_id',
  'tmu.uuid as pic_id',
  'tmk.uuid as kanban_id',
  'tmz.uuid as zone_id',
  'tmf.uuid as freq_id',
  'tmf.freq_id as freq_real_id',
  'tmz.zone_id as zone_real_id',
  'tmk.kanban_id as kanban_real_id',
  'tmu.user_id as pic_real_id',
  'tmz.zone_nm',
  'tmk.kanban_no',
  'tmk.area_nm',
  'tmk.standart_time',
  'tmu.fullname as pic_nm',
  'tmf.freq_nm'
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
  picRealId
) => {
  let byPic = ``
  if (picRealId)
  {
    byPic = ` and trcs.pic_id = '${picRealId}' `
  }
  let childrenSql = `
              select * from (
                 select
                    tbrcs.uuid as sub_schedule_id,
                    trcc1.tl1_sign_checker_id,
                    trcc2.tl2_sign_checker_id,
                    EXTRACT('Day' FROM tmsc.date)::INTEGER as date_num,
                    tmsc.is_holiday,
                    case
                      when tbrcs.shift = 'night_shift' then
                        'NightShift'
                      when tbrcs.plan_time is not null and tbrcs.actual_time is null then
                        'PLANNING'
                      when tbrcs.actual_time is not null then
                        'ACTUAL'
                      else
                        null
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
                  where
                      tbrcs.deleted_dt is null
                      and tbrcs.main_schedule_id = ${mainScheduleRealId}
                      and tbrcs.freq_id = '${freqRealId}'
                      and tbrcs.zone_id = '${zoneRealId}'
                      and tbrcs.kanban_id = '${kanbanRealId}'
                      ${byPic}
              ) a order by date_num      
           `

  const children = await queryCustom(childrenSql)

  return children.rows
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
            filterCondition.push(` trcp.month_num = '${MYFilterSplit[0]}}' `)
          }
        }
        else
        {
          filterCondition.push(` trcp.year_num || '-' || trcp.month_num = '${MYFilterSplit[0]}-${padTwoDigits(MYFilterSplit[1])}' `)
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

      const result = {
        schedule: [],
        sign_checker_gl: [],
        sign_checker_sh: [],
      }

      let scheduleSql = `
          select * from (
            select distinct on (tbrcs.freq_id, tbrcs.zone_id, tbrcs.kanban_id)
              ${selectSubScheduleSql}  
          from
             ${fromSubScheduleSql}
          where
            tbrcs.deleted_dt is null
            and tbrcs.main_schedule_id = (select main_schedule_id from ${table.tb_r_4s_main_schedules} where uuid = '${main_schedule_id}')
          ) a 
          where
            1 = 1
        `

      let filterCondition = []

      if (freq_id && freq_id != null && freq_id != "")
      {
        filterCondition.push(` tbrcs.freq_id = (select freq_id from ${table.tb_m_freqs} where uuid = '${freq_id}') `)
      }
      if (zone_id && zone_id != null && zone_id != "")
      {
        filterCondition.push(` tbrcs.zone_id = (select zone_id from ${table.tb_m_zones} where uuid = '${zone_id}') `)
      }
      if (kanban_id && kanban_id != null && kanban_id != "")
      {
        filterCondition.push(` tbrcs.kanban_id = (select kanban_id from ${table.tb_m_kanbans} where uuid = '${kanban_id}') `)
      }
      if (line_id && line_id != null && line_id != "")
      {
        filterCondition.push(` trmsc.line_id = (select line_id from ${table.tb_m_lines} where uuid = '${line_id}') `)
      }
      if (month_year_num && month_year_num != null && month_year_num != "")
      {
        let MYFilterSplit = month_year_num.split('-')

        if (MYFilterSplit.length == 1)
        {
          if (MYFilterSplit[0].length == 4)
          {
            filterCondition.push(` trmsc.year_num = '${MYFilterSplit[0]}}' `)
          }
          else
          {
            filterCondition.push(` trmsc.month_num = '${MYFilterSplit[0]}}' `)
          }
        }
        else
        {
          filterCondition.push(` trmsc.year_num || '-' || trmsc.month_num = '${MYFilterSplit[0]}-${padTwoDigits(MYFilterSplit[1])}' `)
        }
      }
      if (group_id && group_id != null && group_id != "")
      {
        filterCondition.push(` trmsc.group_id = (select group_id from ${table.tb_m_groups} where uuid = '${group_id}') `)
      }

      filterCondition = filterCondition.join(' and ')
      scheduleSql = scheduleSql.concat(` ${filterCondition} `)
      scheduleSql = scheduleSql.concat(` 
            order by 
            case freq_nm 
              when 'Daily' then 1
              when 'Weekly' then 2
              when 'Monthly' then 3
            end 
          `
      )

      console.log('scheduleSql', scheduleSql)
      const scheduleQuery = await queryCustom(scheduleSql)

      if (scheduleQuery.rows && scheduleQuery.rows.length > 0)
      {
        let mainScheduleRealId = null

        const scheduleRows = scheduleQuery.rows.map(async (item) => {
          mainScheduleRealId = item.main_schedule_id

          const whereSubScheduleId = ` (select sub_schedule_id from ${table.tb_r_4s_sub_schedules} where uuid = '${item.sub_schedule_id}') `
          const whereFreqId = ` ((select freq_id from ${table.tb_m_freqs} where uuid = '${item.freq_id}' limit 1)) `

          const freqRotationQuery = await queryCustom(`
                        select
                            case
                                when freq_nm = 'Daily' and '${item.freq_nm}' = 'Weekly' then
                                    true
                                else
                                    false
                            end as is_daily_to_weekly,
                            case
                                when freq_nm = 'Weekly' and '${item.freq_nm}' = 'Monthly' then
                                    true
                                else
                                    false
                            end as is_weekly_to_monthly
                        from
                            ${table.tb_r_4s_schedule_revisions} 
                        where
                            sub_schedule_id = ${whereSubScheduleId}
                        order by
                            schedule_revision_id desc 
                        limit 1
                    `)
          const freqRotationRow = freqRotationQuery.rows
          if (freqRotationRow && freqRotationRow.length > 0)
          {
            item.is_daily_to_weekly =
              freqRotationRow[0].is_daily_to_weekly ?? false
            item.is_weekly_to_monthly =
              freqRotationRow[0].is_weekly_to_monthly ?? false
          }

          const countRowSpanSql = `
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
          const countRowSpanQuery = await queryCustom(countRowSpanSql)


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
            `)
        }

        const signGl = await signCheckerQuery('gl')
        const signSh = await signCheckerQuery('sh')

        result.schedule = await Promise.all(scheduleRows)
        result.sign_checker_gl = signGl.rows
        result.sign_checker_sh = signSh.rows

        response.success(res, "Success to get 4s sub schedule", result)
      } else
      {
        response.success(res, "Success to get 4s sub schedule", result)
      }
    } catch (error)
    {
      console.log(error)
      response.failed(res, "Error to get 4s sub schedule")
    }
  },
  detail4sSubSchedule: async (req, res) => {
    try
    {
      const sub_schedule_uuid = req.params.id

      const subScheduleSql = `
        select 
          ${selectSubScheduleSql}
        from
          ${fromSubScheduleSql}
        where
          tbrcs.uuid = '${sub_schedule_uuid}'
    `

      let subScheduleQuery = await queryCustom(subScheduleSql)
      if (subScheduleQuery.rows.length == 0)
      {
        throw "Can't find 4s sub schedule with id provided"
      }

      subScheduleQuery = subScheduleQuery[0]
      subScheduleQuery.children = await childrenSubSchedule(
        subScheduleQuery.main_schedule_id,
        subScheduleQuery.freq_real_id,
        subScheduleQuery.zone_real_id,
        subScheduleQuery.kanbanRealId,
        subScheduleQuery.pic_real_id
      )

      subScheduleQuery.main_schedule_id = subScheduleQuery.main_schedule_uuid

      delete subScheduleQuery.freq_real_id
      delete subScheduleQuery.zone_real_id
      delete subScheduleQuery.kanban_real_id
      delete subScheduleQuery.pic_real_id
      delete subScheduleQuery.main_schedule_uuid

      const result = {
        schedule: subScheduleQuery,
        zona: []
      }

      response.success(res, "Success to get detail 4s sub schedule", subScheduleQuery)
    }
    catch (error)
    {
      console.log(error)
      response.failed(res, "Error to get 4s sub schedule detail")
    }


  },
  edi4sSubSchedule: async (req, res) => {
    try
    {
      /**
       * plan_dates = 2024-03-01; 2024-03-02; ....
       */
      const { pic_id, kanban_id, zone_id, freq_id, plan_dates } = req.body

      let schedulRow = await queryGET(
        table.tb_r_4s_sub_schedules,
        `WHERE sub_schedule_id = (select sub_schedule_id from ${table.tb_r_4s_sub_schedules} where uuid = '${req.params.id}' limit 1)`
      )

      if (!schedulRow)
      {
        response.failed(
          res,
          "Error to edit 4s planning schedule, can't find schedule data"
        )
        return
      }

      schedulRow = schedulRow[0]

      const planTimeMapped = plan_dates.split(';').map((dt) => {
        return dt.replace(/ /g, '')
      })

      const picData = {
        pic_id: ` (select user_id from ${table.tb_m_users} where uuid = '${pic_id}') `,
        kanban_id: ` (select kanban_id from ${table.tb_m_kanbans} where uuid = '${kanban_id}') `,
        freq_id: ` (select freq_id from ${table.tb_m_freqs} where uuid = '${freq_id}') `,
        zone_id: ` (select zone_id from ${table.tb_m_zones} where uuid = '${zone_id}') `,
      }


      await queryTransaction(async (db) => {
        const attrsUpdatePicFinding = await attrsUserUpdateData(req, picData)
        const updateCondition = `
            main_schedule_id = '${schedulRow.main_schedule_id}' 
            and freq_id = '${schedulRow.freq_id}' 
            and zone_id = '${schedulRow.zone_id}' 
            and kanban_id = '${schedulRow.kanban_id}'
          `

        await queryPutTransaction(
          db,
          table.tb_r_4s_sub_schedules,
          attrsUpdatePicFinding,
          `WHERE ${updateCondition}`
        )

        let temp = []
        for (let i = 0; i < planTimeMapped.length; i++)
        {
          temp.push(`
              update 
                ${table.tb_r_4s_sub_schedules} 
              set 
                plan_time = '${planTimeMapped[i]}' 
              where 
                ${updateCondition} 
                and schedule_id = (select schedule_id from ${table.tb_m_schedules} where "date" = '${planTimeMapped[i]}' limit 1)
            `)
        }

        await db.query(temp.join('; '))
      })

      response.success(res, "Success to edit 4s schedule plan")
    } catch (e)
    {
      console.log(e)
      response.failed(res, "Error to edit 4s schedule plan")
    }
  },
  sign4sSchedule: async (req, res) => {
    try
    {
      const sign_checker_id = req.params.sign_checker_id

      let signCheckerQuery = await queryGET(
        table.tb_r_4s_schedule_sign_checkers,
        `where uuid = '${sign_checker_id}'`,
        [
          'sign',
          'is_tl_1',
          'is_tl_2',
          'is_gl',
          'is_sh'
        ]
      )

      if (!signCheckerQuery || signCheckerQuery.length == 0)
      {
        throw "invalid params, unknown data"
      }

      let attrsUpdate = await attrsUserUpdateData(req, req.body)
      await queryPUT(table.tb_r_4s_schedule_sign_checkers, attrsUpdate, `WHERE uuid = '${sign_checker_id}'`)
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
      let subScheduleRow = await queryGET(
        table.tb_r_4s_sub_schedules,
        `WHERE uuid = '${req.params.id}'`
      )

      if (!subScheduleRow)
      {
        response.failed(
          res,
          "Error to delete 4s sub schedule, can't find schedule data"
        )
        return
      }

      subScheduleRow = subScheduleRow[0]

      let obj = {
        deleted_dt: "CURRENT_TIMESTAMP",
        deleted_by: req.user.fullname
      }

      await queryPUT(
        table.tb_r_4s_sub_schedules,
        obj,
        `
            WHERE  
            main_schedule_id = '${subScheduleRow.main_schedule_id}' 
            and freq_id = '${subScheduleRow.freq_id}' 
            and zone_id = '${subScheduleRow.zone_id}' 
            and kanban_id = '${subScheduleRow.kanban_id}'
          `
      )

      response.success(res, 'success to delete 4s sub schedule', [])
    } catch (e)
    {
      console.log(e)
      response.failed(res, "Error to delete 4s sub schedule")
    }
  },
}
