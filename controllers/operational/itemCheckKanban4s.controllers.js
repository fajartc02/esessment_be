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
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")

module.exports = {
    getItemCheckKanban4sByMainScheduleId: async (req, res) => {
        try
        {
            const { main_schedule_id } = req.query

            const itemCheckSql = `
            select distinct
              on (
                  tbrcs.freq_id,
                  tbrcs.zone_id,
                  tbrcs.kanban_id,
                  tmic.item_check_kanban_id
              )
              tmk.uuid as kanban_uuid,
              tmic.uuid as item_check_kanban_uuid,
              tmf.uuid as freq_uuid,
              tbrcs.main_schedule_id,
              tmic.item_check_kanban_id,
              tmk.kanban_id,
              tbrcs.freq_id,
              tbrcs.zone_id,
              tmic.item_check_nm,
              tmk.kanban_no,
              tmic.standart_time,
              tmf.freq_nm
          from
              ${table.tb_r_4s_sub_schedules} tbrcs
              join ${table.tb_m_4s_item_check_kanbans} tmic on tbrcs.kanban_id = tmic.kanban_id
              join ${table.tb_m_kanbans} tmk on tmic.kanban_id = tmk.kanban_id
              join ${table.tb_m_freqs} tmf on tbrcs.freq_id = tmf.freq_id
          where
              tbrcs.main_schedule_id = (select main_schedule_id from ${table.tb_r_4s_main_schedules} where uuid = '${main_schedule_id}')
        `

            const itemCheckQuery = await queryCustom(itemCheckSql)
            let result = []

            if (itemCheckQuery && itemCheckQuery.rows.length > 0)
            {
                const childrenSql = (
                    freq = '',
                    mainScheduleRealId = 0,
                    freqRealId = 0,
                    kanbanRealId = 0,
                    zoneRealId = 0,
                    mstItemCheckKanbanRealId = 0
                ) => {
                    const joinWeekly = `
                            join (select date_part('week', "date"::date) week from tb_m_schedules group by week) tmsw
                                on date_part('week', tmsc."date"::date) = tmsw.week
                        `
                    const joinMonthly = `
                            join (select date_part('month', "date") as month from tb_m_schedules group by month) tmsw
                                on date_part('month', tmsc."date"::date) = tmsw.month
                        `
                    const sql = (distinct = '') => {
                        return `
                            select
                                    ${distinct}
                                    EXTRACT('Day' FROM tmsc.date)::INTEGER as offset,
                                    tmic.item_check_nm,
                                    tr4ssick.actual_time
                            from ${table.tb_r_4s_sub_schedules} tbrcs
                                    join ${table.tb_m_schedules} tmsc on tbrcs.schedule_id = tmsc.schedule_id
                                    join ${table.tb_m_4s_item_check_kanbans} tmic on tbrcs.kanban_id = tmic.kanban_id
                                    left join ${table.tb_r_4s_schedule_item_check_kanbans} tr4ssick
                                                on tmic.item_check_kanban_id = tr4ssick.item_check_kanban_id and
                                                    tr4ssick.sub_schedule_id = tbrcs.sub_schedule_id
                        `
                    }

                    const whereDistinct = `
                            where tbrcs.main_schedule_id = '${mainScheduleRealId}'
                            and tbrcs.freq_id = '${freqRealId}'
                            and tbrcs.kanban_id = '${kanbanRealId}'
                            and tbrcs.zone_id = '${zoneRealId}'
                            and tmic.item_check_kanban_id = '${mstItemCheckKanbanRealId}'
                        `

                    let result = ''
                    switch (freq.toLowerCase())
                    {
                        case 'daily':
                            result = sql()
                            break;
                        case 'weekly':
                            result = sql('distinct on (tmsw.week) tmsw.week, ').concat(` ${joinWeekly} `)
                            break;
                        case 'monthly':
                            result = sql('distinct on (tmsw.month) tmsw.month, ').concat(` ${joinMonthly} `)
                            break;
                        default:
                            result = sql()
                            break;
                    }

                    result = result.concat(` ${whereDistinct} `)
                    return result
                }

                const itemCheckRows = itemCheckQuery.rows.map(async (item) => {
                    const cSql = childrenSql(
                        item.freq_nm,
                        item.main_schedule_id,
                        item.freq_id,
                        item.kanban_id,
                        item.zone_id,
                        item.item_check_kanban_id
                    )
                    //console.log(`cSql ${item.freq_nm}`, cSql)
                    const children = await queryCustom(cSql, false)
                    children.rows = children.rows.map((child) => {
                        if (child.week)
                        {
                            child.offset = child.week
                            delete child.week
                        }
                        else if (child.month)
                        {
                            child.offset = child.month
                            delete child.month
                        }

                        return child
                    })


                    item.kanban_id = item.kanban_uuid
                    item.item_check_kanban_id = item.item_check_kanban_uuid
                    item.freq_id = item.freq_uuid
                    item.children = children.rows

                    delete item.freq_uuid
                    delete item.zone_id
                    delete item.kanban_uuid
                    delete item.item_check_kanban_uuid
                    delete item.main_schedule_id

                    return item
                })

                result = await Promise.all(itemCheckRows)
            }

            response.success(res, "Success to get 4s item check kanban", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, "Error to get 4s item check kanban")
        }
    },
    getItemCheckKanban4sByKanbanId: async (req, res) => {
        try
        {

            response.success(res, "Success to edit 4s item check kanban", [])
        } catch (error)
        {
            console.log(error)
            response.failed(res, "Error to get 4s item check kanban by kanban id")
        }
    },
    editItemCheckKanban4s: async (req, res) => {
        try
        {
            const itemCheckKanbanUuid = req.params.id
            const { actual_time, judgement } = req.body

            const updateBody = {
                ...req.body,
            }

            const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
            const result = await queryPUT(
                table.tb_r_4s_schedule_item_check_kanbans,
                attrsUserUpdate,
                `WHERE uuid = '${itemCheckKanbanUuid}'`
            )

            response.success(res, "Success to edit 4s item check kanban", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, "Error to edit 4s item check kanban")
        }
    }
}