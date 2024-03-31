const table = require("../../config/table")
const { queryPUT, queryCustom, queryPOST, queryTransaction, queryPostTransaction } = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")
const { bulkToSchema } = require("../../helpers/schema")

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
                        )::text as id,
                        tmg.uuid as group_id,
                        tms.uuid as shift_id,
                        tmg.group_nm,
                        tms.start_date as start,
                        tms.end_date as end,
                        tms.shift_type,
                        tms.is_holiday,
                        tms.holiday_desc,
                        tms.allday as allDay,
                        tms.title,
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
            /* 
            const shifts = req.body.shifts
            const insertBodys = []
            if (Array.isArray(shifts))
            {
                shifts.forEach((shift) => {
                    insertBodys.push(
                        attrsUserInsertData(req, {
                            uuid: uuid(),
                            title: shift.title,
                            allday: shift.allday,
                            group_id: `(select group_id from ${table.tb_m_groups} where uuid = '${shift.group_id}') `,
                            start_date: shift.start,
                            end_date: shift.end,
                            shift_type: shift.shift_type,
                            is_holiday: shift.is_holiday,
                            holiday_desc: shift.holiday_desc,
                        })
                    )
                })
            } */

            const transaction = await queryTransaction(async (db) => {
                const shift = req.body
                const schema = await attrsUserInsertData(req, {
                    uuid: uuid(),
                    title: shift.title,
                    all_day: shift.allDay,
                    group_id: `(select group_id from ${table.tb_m_groups} where uuid = '${shift.group_id}') `,
                    start_date: shift.start,
                    end_date: shift.end,
                    shift_type: shift.shift_type,
                    is_holiday: shift.is_holiday,
                    holiday_desc: shift.holiday_desc,
                })

                return await queryPostTransaction(db, table.tb_m_shifts, schema)
                //return await db.query(` insert into ${table.tb_m_shifts} (${schema.columns}) VALUES ${schema.values} returning *`)
            })

            response.success(res, "Success to add shift", transaction.rows)
        } catch (error)
        {
            console.log('postShift', error)
            response.failed(res, error)
        }
    },
    editShift: async (req, res) => {
        try
        {
            const shift = req.body

            const updateBody = {
                title: shift.title,
                all_day: shift.allDay,
                group_id: `(select group_id from ${table.tb_m_groups} where uuid = '${shift.group_id}') `,
                start_date: shift.start,
                end_date: shift.end,
                shift_type: shift.shift_type,
                is_holiday: shift.is_holiday,
                holiday_desc: shift.holiday_desc,
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
