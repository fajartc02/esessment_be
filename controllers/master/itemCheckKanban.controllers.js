const table = require("../../config/table")
const { queryPUT, queryCustom, queryPOST } = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")

const moment = require("moment")
const { uuid } = require("uuidv4")

module.exports = {
    /**
     * @param {*} req
     * @param {*} res 
     * @param {JSON} req.query.id is determine for detail usecase
     */
    getItemCheckKanbans: async (req, res) => {
        try
        {
            let { id, kanban_id, limit, current_page } = req.query
            const fromCondition = ` 
                        ${table.tb_m_4s_item_check_kanbans} tmic
                        join ${table.tb_m_kanbans} tmk on tmic.kanban_id = tmk.kanban_id 
                `

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            let filterCondition = [
                ' and tmic.deleted_dt is null '
            ]

            let itemCheckQuery = `
                   select
                        tmic.uuid as item_check_kanban_id,
                        tmk.uuid as kanban_id,
                        tmk.kanban_no,
                        tmic.item_check_nm,
                        tmic.standart_time,
                        tmic.created_by,
                        tmic.created_dt
                    from
                        ${fromCondition}
                    where
                        1 = 1
                `
            //#region filter
            if (id)
            {
                filterCondition.push(` tmic.uuid = '${id}' `)
            }
            if (kanban_id)
            {
                filterCondition.push(` tmk.uuid = '${kanban_id}' `)
            }
            
            const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

            filterCondition = filterCondition.join(' and ')
            itemCheckQuery = itemCheckQuery.concat(` ${filterCondition} `)
            itemCheckQuery = itemCheckQuery.concat(` order by tmic.created_dt ${qLimit} ${qOffset} `)
            //#endregion

            const itemChecks = await queryCustom(itemCheckQuery)
            const nullId = id == null || id == -1 || id == ''
            let result = itemChecks.rows

            if (itemChecks.rows.length > 0)
            {
                if (nullId)
                {
                    const count = await queryCustom(`select count(tmic.item_check_kanban_id) as count from ${fromCondition} where 1 = 1 ${filterCondition}`)
                    const countRows = count.rows[0]
                    result = {
                        current_page: current_page,
                        total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +limit) : 0,
                        limit: limit,
                        list: itemChecks.rows,
                    }
                }
                else
                {
                    result = result[0]
                }
            }

            response.success(res, "Success to get item check kanbans", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, "Error to get item check kanbans")
        }
    },
    postItemCheck: async (req, res) => {
        try
        {
            const insertBody = {
                ...req.body,
                uuid: uuid(),
                kanban_id: ` (select kanban_id from ${table.tb_m_kanbans} where uuid = '${req.body.kanban_id}') `
            }

            const attrsInsert = await attrsUserInsertData(req, insertBody)
            const result = await queryPOST(table.tb_m_4s_item_check_kanbans, attrsInsert)
            response.success(res, "Success to add item check kanban", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
    editItemCheck: async (req, res) => {
        try
        {
            const updateBody = {
                ...req.body,
                kanban_id: ` (select kanban_id from ${table.tb_m_kanbans} where uuid = '${req.body.kanban_id}') `,
            }

            const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
            const result = await queryPUT(
                table.tb_m_4s_item_check_kanbans,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )

            response.success(res, "Success to edit item check kanban", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
    deleteItemCheck: async (req, res) => {
        try
        {
            let obj = {
                deleted_dt: moment().format().split("+")[0].split("T").join(" "),
                deleted_by: req.user.fullname,
            }

            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(
                table.tb_m_4s_item_check_kanbans,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )
            response.success(res, "Success to soft delete item check kanban", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
}
