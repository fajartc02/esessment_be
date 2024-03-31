const table = require("../../config/table")
const { queryPUT, queryGET, queryCustom, queryPOST, queryTransaction, queryPostTransaction, queryPutTransaction } = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")

const moment = require("moment")
const { uuid } = require("uuidv4")

module.exports = {
    get4sFindingList: async (req, res) => {
        try
        {
            let { id, line_id, freq_id, zone_id, kanban_id, limit, current_page } = req.query
            const fromCondition = `  
                ${table.v_4s_finding_list} vfl 
            `

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            let filterCondition = [
                'vfl.deleted_dt is null'
            ]

            let findingSql = `
                    select
                        *
                    from
                       ${fromCondition}
                    where
                        
                `
            //#region filter
            if (id)
            {
                filterCondition.push(` vfl.finding_id = '${id}' `)
            }
            if (line_id)
            {
                filterCondition.push(` vfl.line_id = '${line_id}' `)
            }
            if (zone_id)
            {
                filterCondition.push(` vfl.zone_id = '${zone_id}' `)
            }
            if (kanban_id)
            {
                filterCondition.push(` vfl.kanban_id = '${kanban_id}' `)
            }


            const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

            
            filterCondition = filterCondition.join(' and ')
            findingSql = findingSql.concat(` ${filterCondition} `)
            findingSql = findingSql.concat(` order by vfl.created_dt ${qLimit} ${qOffset} `)
            //#endregion

            let findingQuery = await queryCustom(findingSql)
            const nullId = id == null || id == -1 || id == ''
            let result = findingQuery.rows

            if (result.length > 0)
            {
                if (nullId)
                {
                    const count = await queryCustom(`select count(*) as count from ${fromCondition} where ${filterCondition}`)
                    const countRows = count.rows[0]
                    result = {
                        current_page: current_page,
                        total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +limit) : 0,
                        total_data: countRows.count,
                        limit: limit,
                        list: findingQuery.rows,
                    }
                }
                else
                {
                    result = result[0]
                }
            }

            response.success(res, 'Success to get 4s finding list', result)
        } catch (error)
        {
            console.log(error);
            response.failed(res, 'Error to get 4s finding list')
        }
    },
    post4sFinding: async (req, res) => {
        try
        {
            const insertBody = {
                ...req.body,
                uuid: uuid(),
                schedule_item_check_kanban_id: ` (select schedule_item_check_kanban_id from ${table.tb_r_4s_schedule_item_check_kanbans} where uuid = '${req.body.schedule_item_check_kanban_id}') `,
                line_id: ` (select line_id from ${table.tb_m_lines} where uuid = '${req.body.line_id}') `,
                freq_id: ` (select freq_id from ${table.tb_m_freqs} where uuid = '${req.body.freq_id}') `,
                zone_id: ` (select zone_id from ${table.tb_m_zones} where uuid = '${req.body.zone_id}') `,
                kanban_id: ` (select kanban_id from ${table.tb_m_kanbans} where uuid = '${req.body.kanban_id}') `,
                finding_pic_id: ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.finding_pic_id}') `,
            }

            const transaction = await queryTransaction(async (db) => {
                const attrsInsert = await attrsUserInsertData(req, insertBody)
                return await queryPostTransaction(db, table.tb_r_4s_findings, attrsInsert)
            })

          
            response.success(res, "Success to add 4s finding", transaction.rows)
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
    edit4sFinding: async (req, res) => {
        try
        {
            const updateBody = {
                ...req.body,
                actual_pic_id: ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.actual_pic_id}') `
            }

            const transaction = await queryTransaction(async (db) => {
                const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
                return await queryPutTransaction(
                    table.tb_m_freqs,
                    attrsUserUpdate,
                    `WHERE uuid = '${req.params.id}'`
                )
            })

            response.success(res, "Success to edit 4s finding", transaction)
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
    upload4sImageFinding: async (req, res) => {
        try
        {
            if (req.file)
            {
                req.body.finding_img = `./${req.file.path}`
            }

            if (req.body.before_path != null && req.body.before_path != 'null' && req.body.before_path)
            {
                removeFileIfExist(req.body.before_path)
            }

            const findingUuid = req.body.finding_id

            delete req.body.dest
            delete req.body.finding_id
            delete req.body.before_path

            await queryPUT(table.tb_r_4s_findings, req.body, `WHERE finding_id = '${findingUuid}'`);
            response.success(res, 'Success to upload 4s image finding', req.body.finding_img);
        } catch (error)
        {
            response.failed(res, 'Error to upload 4s image finding')
        }
    },
    delete4sFinding: async (req, res) => {
        try
        {
            let obj = {
                deleted_dt: moment().format().split("+")[0].split("T").join(" "),
                deleted_by: req.user.fullname,
            }

            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(
                table.tb_r_4s_findings,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )
            response.success(res, "Success to soft delete freq", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
}
