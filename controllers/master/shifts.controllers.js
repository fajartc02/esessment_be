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
            let { id, group_id, start_date, end_date, limit, current_page, month, year } = req.query
            const fromCondition = ` 
                ${table.tb_m_shifts} tms 
                left join ${table.tb_m_groups} tmg on tms.group_id = tmg.group_id 
            `

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 100)

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
                        tms.holiday_desc,
                        tms.all_day as allDay,
                        tms.title,
                        tms.is_holiday,
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
            if (month)
            {
                filterCondition.push(`(date_part('month', tms.start_date) = '${month}' or date_part('month', tms.end_date) = '${month}')`)
            }
            if (year)
            {
                filterCondition.push(`(date_part('year', tms.start_date) = '${year}' or date_part('year', tms.end_date) = '${year}')`)
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
                let nationalHolidaySql =
                    `
                        select
                            row_number () over (
                                order by
                                created_dt
                            )::text as id,
                            null as group_id,
                            null as shift_id,
                            true as allDay,
                            date as start,
                            date as end,
                            is_holiday,
                            holiday_nm as title
                        from 
                            ${table.tb_m_schedules}
                        where 
                            is_holiday = true 
                            and holiday_nm is not null
                    `
                let filterNational = []
                if (month)
                {
                    filterNational.push(` date_part('month', date) = '${month}' `)
                }
                if (year)
                {
                    filterNational.push(` date_part('year', date) = '${year}' `)
                }

                if (filterNational.length > 0)
                {
                    nationalHolidaySql = nationalHolidaySql.concat(` and ${filterNational.join(' and ')} `)
                }

                const nationalHoliday = await queryCustom(nationalHolidaySql)
                nationalHoliday.rows = nationalHoliday.rows.map((item) => {
                    item.id = `${+item.id + result.length}`
                    return item
                })

                if (nullId)
                {
                    const count = await queryCustom(`select count(*)::integer as count from ${fromCondition} where ${filterCondition}`)
                    const countRows = count.rows[0]
                    result = {
                        current_page: current_page,
                        total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +limit) : 0,
                        total_data: countRows.count,
                        limit: limit,
                        list: [...result, ...nationalHoliday.rows]
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
            const shift = req.body

            let sqlExists =
                `
                    select
                        *
                    from
                        ${table.tb_m_shifts}
                    where
                        (
                            (start_date >= '${shift.start}' and start_date <= '${shift.end}') or (end_date >= '${shift.start}' and end_date <= '${shift.end}')
                            -- or (start_date between ${shift.start}' and '${shift.end}' or end_date between ${shift.start}' and '${shift.end}')
                        )
                `
            if (shift.is_holiday)
            {
                sqlExists = sqlExists.concat(` and is_holiday = true `)
            }
            else
            {
                sqlExists = sqlExists.concat(` and (is_holiday = false or is_holiday is null) `)
            }

            if (shift.group_id)
            {
                sqlExists = sqlExists.concat(` and group_id = (select group_id from ${table.tb_m_groups} where uuid = '${shift.group_id}') `)
            }
            else
            {
                sqlExists = sqlExists.concat(` and group_id is null `)
            }

            const exists = await queryCustom(sqlExists)
            if (exists.rowCount > 0)
            {
                throw `Date range between '${shift.start}' and '${shift.end}' are exists, please try different ranges`
            }

            const transaction = await queryTransaction(async (db) => {

                const schema = await attrsUserInsertData(req, {
                    uuid: uuid(),
                    title: shift.title,
                    all_day: shift.allDay,
                    start_date: shift.start,
                    end_date: shift.end,
                    shift_type: shift.shift_type,
                    is_holiday: shift.is_holiday,
                    holiday_desc: shift.holiday_desc,
                })

                if (shift.group_id)
                {
                    schema.group_id = `(select group_id from ${table.tb_m_groups} where uuid = '${shift.group_id}') `
                }

                return await queryPostTransaction(db, table.tb_m_shifts, schema)
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
                start_date: shift.start,
                end_date: shift.end,
                shift_type: shift.shift_type,
                is_holiday: shift.is_holiday,
                holiday_desc: shift.holiday_desc,
            }

            if (shift.group_id)
            {
                schema.group_id = `(select group_id from ${table.tb_m_groups} where uuid = '${shift.group_id}') `
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
            await queryDELETE(
                table.tb_m_shifts,
                `WHERE uuid = '${req.params.id}'`
            )
            response.success(res, "Success to soft delete shift", [])
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
}
