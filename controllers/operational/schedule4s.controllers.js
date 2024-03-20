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

module.exports = {
  get4sMainSchedule: async (req, res) => {
    try
    {
      const { line_id } = req.query

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
                    ${table.tb_r_4s_main_schedules} trcp
                    join ${table.tb_m_lines} tml on trcp.line_id = tml.line_id
                    join ${table.tb_m_groups} tmg on trcp.group_id = tmg.group_id
                where 
                    trcp.deleted_dt is null
            `

      if (line_id && line_id != null && line_id != "")
      {
        mainScheduleSql = mainScheduleSql.concat(
          ` and trcp.line_id = (select line_id from ${table.tb_m_lines} where uuid = '${line_id}') `
        )
      }

      const mainScheduleQuery = await queryCustom(mainScheduleSql)
      const result = await Promise.all(mainScheduleQuery.rows)

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
      const { main_schedule_id, freq_id, zone_id, kanban_id } = req.query

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
          select distinct on (tbrcs.kanban_id)
              tbrcs.main_schedule_id,    
              tbrcs.uuid as sub_schedule_id,
              tmu.uuid as pic_id,
              tmk.uuid as kanban_id,
              tmz.uuid as zone_id,
              tmf.uuid as freq_id,
              tmz.zone_nm,
              tmk.kanban_no,
              tmk.area_nm,
              tmk.standart_time,
              tmu.fullname as pic_nm,
              tmf.freq_nm
          from
              ${table.tb_r_4s_sub_schedules} tbrcs
              join ${table.tb_r_4s_main_schedules} trmsc on tbrcs.main_schedule_id = trmsc.main_schedule_id
              join ${table.tb_m_users} tmu on tmu.user_id = tbrcs.pic_id
              join ${table.tb_m_kanbans} tmk on tbrcs.kanban_id = tbrcs.kanban_id
              join ${table.tb_m_zones} tmz on tbrcs.zone_id = tmz.zone_id
              join ${table.tb_m_freqs} tmf on tbrcs.freq_id = tmf.freq_id
              join ${table.tb_m_schedules} tmsc on tbrcs.schedule_id = tmsc.schedule_id
              join lateral (
                  select
                    pic_id,
                    kanban_id,
                    count(*) as total
                  from
                      ${table.tb_r_4s_sub_schedules}
                  where
                    main_schedule_id = tbrcs.main_schedule_id
                  group by 
                    kanban_id, 
                    pic_id
                ) tbrcs_group on tbrcs_group.pic_id = tbrcs.pic_id and tbrcs_group.kanban_id = tbrcs.kanban_id
          where
            tbrcs.deleted_dt is null
            and tbrcs.main_schedule_id = (select main_schedule_id from ${table.tb_r_4s_main_schedules} where uuid = '${main_schedule_id}')

        `

      if (freq_id && freq_id != null && freq_id != "")
      {
        scheduleSql = scheduleSql.concat(
          ` and tbrcs.freq_id = (select freq_id from ${table.tb_m_freqs} where uuid = '${freq_id}') `
        )
      }
      if (zone_id && zone_id != null && zone_id != "")
      {
        scheduleSql = scheduleSql.concat(
          ` and tbrcs.zone_id = (select zone_id from ${table.tb_m_zones} where uuid = '${zone_id}') `
        )
      }
      if (kanban_id && kanban_id != null && kanban_id != "")
      {
        scheduleSql = scheduleSql.concat(
          ` and tbrcs.kanban_id = (select kanban_id from ${table.tb_m_kanbans} where uuid = '${kanban_id}') `
        )
      }

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

          const countRowSpanQuery = await queryCustom(`
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
                select * from pics, zones, freqs
          `)

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

          const children = await queryCustom(`
              select * from (
                 select
                    distinct on (trcs.uuid)
                    trcs.uuid as sub_schedule_id,
                    EXTRACT('Day' FROM tmsc.date)::INTEGER as date_num,
                    tmsc.is_holiday,
                    trcc1.sign as sign_tl_1,
                    trcc2.sign as sign_tl_2,
                    trcs.actual_time,
                    trcs.plan_time,
                    tmf.freq_nm,
                    case
                      when trcs.shift = 'night_shift' then
                        'NightShift'
                      when trcs.plan_time is not null and trcs.actual_time is null then
                        'PLANNING'
                      when trcs.actual_time is not null then
                        'ACTUAL'
                      else
                        null
                    end as status
                  from
                      ${table.tb_r_4s_sub_schedules} trcs
                      left join ${table.tb_r_4s_schedule_sign_checkers} trcc1 on trcs.main_schedule_id = trcc1.main_schedule_id and trcc1.is_tl_1 = true  
                      left join ${table.tb_r_4s_schedule_sign_checkers} trcc2 on trcs.main_schedule_id = trcc2.main_schedule_id and trcc2.is_tl_2 = true  
                      left join ${table.tb_m_schedules} tmsc on trcs.schedule_id = tmsc.schedule_id
                      left join ${table.tb_m_freqs} tmf on trcs.freq_id = tmf.freq_id
                  where
                      trcs.deleted_dt is null
                      and trcs.main_schedule_id = ${item.main_schedule_id}
                      and trcs.pic_id = (select user_id from ${table.tb_m_users} where uuid = '${item.pic_id}' limit 1)
                      and trcs.freq_id = (select freq_id from ${table.tb_m_freqs} where uuid = '${item.freq_id}' limit 1)
                      -- and trcs.zone_id = (select zone_id from ${table.tb_m_zones} where uuid = '${item.zone_id}' limit 1)
                      -- and trcs.kanban_id = (select kanban_id from ${table.tb_m_kanbans} where uuid = '${item.kanban_id}' limit 1)
              ) a order by date_num      
            `
          )

          let planIndexWeekly = 0
          let planIndexMonthly = 0
          children.rows = await children.rows.map((childItem, index) => {

            switch (childItem.freq_nm.toLowerCase())
            {
              case "weekly":
                planIndexWeekly++
                if (!childItem.is_holiday && (childItem.date_num == 4 || childItem.date_num == 18))
                {
                  childItem.status = "PLANNING"
                } else
                {
                  childItem.status = null
                }

                break
              case "monthly":
                planIndexMonthly++
                if (planIndexMonthly == 1 && childItem.is_holiday)
                {
                  childItem.status = "PLANNING"
                } else
                {
                  childItem.status = null
                }

                break
              case "daily":
                if (!childItem.is_holiday)
                {
                  childItem.status = "PLANNING"
                } 
                else
                {
                  childItem.status = null
                }

                break
            }

            delete childItem.actual_time
            delete childItem.plan_time
            delete childItem.freq_nm

            return childItem
          })

          item.children = children.rows
          item.main_schedule_id = main_schedule_id

          return item
        })

        const planDateQuery = await queryCustom(`
                    select 
                        month_num,
                        year_num
                    from
                        ${table.tb_r_4s_main_schedules} 
                    where
                        uuid = '${main_schedule_id}'
            `)
        let planDateRow = planDateQuery.rows[0]

        const glSignCheckerQuery = await queryCustom(`
          select
            weekly.*,
						tr4c_gl.sign as sign_gl
          from (
              select
                  week_num,
                  count(distinct "date")::integer as col_span
              from
                  ${table.tb_m_schedules} tmsc
              where
                  date_part('month', "date") = '${planDateRow.month_num}'
                  and date_part('year', "date") = '${planDateRow.year_num}'
                  and (is_holiday is null or is_holiday = false)
              group by 
                  week_num
              order by 
                  week_num
          ) weekly
          left join lateral (
						select
							sign
						from
							${table.tb_r_4s_schedule_sign_checkers}
						where
							main_schedule_id = ${mainScheduleRealId}
							and week_num = weekly.week_num
							and is_gl = true
          ) tr4c_gl on true
        `)

        const shColspan = (arr) => {
          let a = []
          let r = []

          arr.forEach((v) => a.push(Object.assign({}, v)))

          for (var i = 0; i < a.length; ++i)
          {
            if (a[i].col_span > 1)
            {
              for (var j = i + 1; j < a.length; ++j)
              {
                a[i].week_num = i + 1
                a[i].col_span = a[i].col_span + a[j].col_span
                delete a[i].sign_gl
                a[i].sign_sh = null
                a.splice(j++, 1)
              }
            } else
            {
              delete a[i].sign_gl
              a[i].week_num = i + 1
              a[i].sign_sh = null
              r.push(a)
            }
          }

          return r
        }

        const glSignCheckerRows = glSignCheckerQuery.rows

        result.schedule = await Promise.all(scheduleRows)
        result.sign_checker_gl = glSignCheckerRows
        result.sign_checker_sh = shColspan(glSignCheckerRows)[0]

        response.success(res, "Success to get 4s schedule", result)
      } else
      {
        response.success(res, "Success to get 4s schedule", result)
      }
    } catch (error)
    {
      console.log(error)
      response.failed(res, "Error to get 4s schedule")
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
      let attrsUpdate = await attrsUserUpdateData(req, req.body)
      await queryPUT(table.tb_r_4s_schedule_sign_checkers, attrsUpdate, `WHERE uuid = '${req.body.sign_checker_id}'`)
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
