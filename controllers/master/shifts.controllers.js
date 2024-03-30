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
    getShifts: async (req, res) => {
        try
        {
            let { id, group_id, start_date, end_date, limit, current_page } = req.query
            const fromCondition = ` 
                ${table.tb_m_shifts} tms 
                join ${table.tb_m_groups} tmg on tms.group_id = tmg.group_id 
            `

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            let filterCondition = [
                'tms.deleted_dt is null'
            ]

            let shiftSql =
                `
                select
                    row_number () over (
                        order by
                        tms.created_dt
                    )::integer as no,
                    tmg.uuid as group_id,
                    tms.uuid as shift_id,
                    tmg.group_nm,
                    tms.start_date,
                    tms.end_date,
                    tms.shift_type,
                    tms.is_holiday,
                    tms.holiday_desc,
                    tms.created_by,
                    tms.created_dt
                from
                    ${fromCondition}
                where
                    1 = 1
            `
            //#region filter
            if (id)
            {
                filterCondition.push(`tms.uuid = '${id}'`)
            }
            if (group_id)
            {
                filterCondition.push(`tmg.uuid = '${group_id}'`)
            }
            if (start_date)
            {
                filterCondition.push(`tms.start_date = '${start_date}'`)
            }
            if (end_date)
            {
                filterCondition.push(`tms.end_date = '${end_date}'`)
            }

            const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

            if (filterCondition.length > 0)
            {
                filterCondition = filterCondition.join(' and ')
                shiftSql = shiftSql.concat(` and ${filterCondition} `)
            }
            shiftSql = shiftSql.concat(` order by tms.created_dt ${qLimit} ${qOffset} `)
            //#endregion

            const shiftQuery = await queryCustom(shiftSql, false)
            const nullId = id == null || id == -1 || id == ''
            let result = shiftQuery.rows

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
                        list: result,
                    }
                }
                else
                {
                    result = result[0]
                }
            }

            response.success(res, "Success to get shifts group", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
    postShift: async (req, res) => {
        try
        {
            const insertBody = {
                ...req.body,
                uuid: uuid(),
                group_id: ` (select group_id from ${table.tb_m_groups} where uuid = '${req.body.group_id}') `,
            }

            const attrsInsert = await attrsUserInsertData(req, insertBody)
            const result = await queryPOST(table.tb_m_shifts, attrsInsert)
            response.success(res, "Success to add shift", result.rows)
        } catch (error)
        {
            console.log('postShift', error)
            response.failed(res, error)
        }
    },
    editShift: async (req, res) => {
        try
        {
            const updateBody = {
                ...req.body,
                group_id: ` (select group_id from ${table.tb_m_groups} where uuid = '${req.body.group_id}') `,
            }

            const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
            const result = await queryPUT(
                table.tb_m_shifts,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )

            response.success(res, "Success to edit shift", result.rows)
        } catch (error)
        {
            console.log('editShift', error)
            response.failed(res, error)
        }
    },
    deleteShift: async (req, res) => {
        try
        {
            let obj = {
                deleted_dt: moment().format().split("+")[0].split("T").join(" "),
                deleted_by: req.user.fullname,
            }

            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(
                table.tb_m_shifts,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )
            response.success(res, "Success to soft delete shift", result.rows)
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
}
