const table = require("../../config/table")
const { queryPUT, queryCustom, queryPOST, queryPostTransaction, queryPutTransaction, queryTransaction, queryGET } = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")

const fs = require('fs')
const moment = require("moment")
const { uuid } = require("uuidv4")

const uploadDest = (dest = '', fileName = null) => {
    const r = `./uploads/${dest}`
    if (fileName)
    {
        r.concat(`/${fileName}`)
    }

    return r
}

module.exports = {
    /**
     * @param {*} req
     * @param {*} res 
     * @param {JSON} req.query.id is determine for detail usecase
     */
    getOemItemCheckKanbans: async (req, res) => {
        try
        {
            let { id, line_id, machine_id, kanban_nm, limit, current_page } = req.query
            const fromCondition = ` 
                        ${table.tb_m_om_item_check_kanbans} tmoich
                        join ${table.tb_m_freqs} tmf on tmoich.freq_id = tmf.freq_id 
                        join ${table.tb_m_machines} tmm on tmoich.machine_id = tmm.machine_id
                        join ${table.tb_m_lines} tml on tmm.line_id = tml.line_id
                `

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            let filterCondition = [
                'tmoich.deleted_dt is null'
            ]

            let itemCheckQuery = `
                   select
                        row_number () over (
                            order by
                            tmoich.created_dt
                        )::integer as no,
                        tmoich.uuid as om_item_check_kanban_id,
                        tml.uuid as line_id,
                        tmf.uuid as freq_id,
                        tmm.uuid as machine_id,
                        tmoich.kanban_nm,
                        tmoich.item_check_nm,
                        tmoich.location_nm,
                        tmoich.method_nm,
                        tmoich.standart_nm,
                        tmoich.standart_time,
                        tmoich.created_by,
                        tmoich.created_dt
                    from
                        ${fromCondition}
                    where
                        
                `
            //#region filter
            if (id)
            {
                filterCondition.push(` tmoich.uuid = '${id}' `)
            }
            if (line_id)
            {
                filterCondition.push(` tml.uuid = '${line_id}' `)
            }
            if (machine_id)
            {
                filterCondition.push(` tmm.uuid = '${machine_id}' `)
            }
            if (kanban_nm)
            {
                filterCondition.push(` tmoich.kanban_nm = '${kanban_nm}' `)
            }

            const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

            filterCondition = filterCondition.join(' and ')
            itemCheckQuery = itemCheckQuery.concat(` ${filterCondition} `)
            itemCheckQuery = itemCheckQuery.concat(` order by tmoich.created_dt ${qLimit} ${qOffset} `)
            //#endregion

            const itemChecks = await queryCustom(itemCheckQuery)
            const nullId = id == null || id == -1 || id == ''
            let result = itemChecks.rows

            if (result.length > 0)
            {
                if (nullId)
                {
                    const count = await queryCustom(`select count(*)::integer as count from ${fromCondition} where ${filterCondition}`)
                    const countRows = count.rows[0]
                    result = {
                        current_page: current_page,
                        total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +limit) : 0,
                        total_data: countRows.count,
                        limit: limit,
                        list: itemChecks.rows,
                    }
                }
                else
                {
                    result = result[0]
                }
            }

            response.success(res, "Success to get om item check kanbans", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, "Error to get om item check kanbans")
        }
    },
    postOemItemCheck: async (req, res) => {
        try
        {
            const transaction = await queryTransaction(async (db) => {
                delete req.body.dest

                const insertBody = {
                    ...req.body,
                    uuid: uuid(),
                    freq_id: ` (select freq_id from ${table.tb_m_freqs} where uuid = '${req.body.freq_id}') `,
                    machine_id: ` (select machine_id from ${table.tb_m_machines} where uuid = '${req.body.machine_id}') `,
                }

                const attrsInsert = await attrsUserInsertData(req, insertBody)
                return await queryPostTransaction(db, table.tb_m_om_item_check_kanbans, attrsInsert)
            })

            const result = {
                om_item_check_kanban_id: transaction.rows[0].uuid ?? null
            }

            response.success(res, "Success to add om item check kanban", result)
        }
        catch (error)
        {
            console.log('postOemItemCheck', error)
            response.failed(res, error)
        }
    },
    editOemItemCheck: async (req, res) => {
        try
        {
            const transaction = await queryTransaction(async (db) => {
                const updateBody = {
                    ...req.body,
                    freq_id: ` (select freq_id from ${table.tb_m_freqs} where uuid = '${req.body.freq_id}') `,
                    machine_id: ` (select machine_id from ${table.tb_m_machines} where uuid = '${req.body.machine_id}') `,
                }

                const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)

                return await queryPutTransaction(
                    db,
                    table.tb_m_om_item_check_kanbans,
                    attrsUserUpdate,
                    `WHERE uuid = '${req.params.id}'`
                )
            })

            const result = {
                om_item_check_kanban_id: transaction.rows[0].uuid ?? null
            }

            response.success(res, "Success to edit om item check kanban", result)
        }
        catch (error)
        {
            console.log('editItemCheck', error)
            response.failed(res, error)
        }
    },
    deleteOemItemCheck: async (req, res) => {
        try
        {
            let obj = {
                deleted_dt: moment().format().split("+")[0].split("T").join(" "),
                deleted_by: req.user.fullname,
            }

            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(
                table.tb_m_om_item_check_kanbans,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )
            response.success(res, "Success to soft delete om item check kanban", {})
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
}
