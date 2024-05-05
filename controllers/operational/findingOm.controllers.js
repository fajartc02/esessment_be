const table = require("../../config/table")
const { queryPUT, queryGET, queryCustom, queryPOST, queryTransaction, queryPostTransaction, queryPutTransaction } = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")
const logger = require("../../helpers/logger")
const moment = require("moment")
const { uuid } = require("uuidv4")

module.exports = {
    getOmFindingList: async (req, res) => {
        try
        {
            let { id, line_id, group_id, freq_id, om_item_check_kanban_id, machine_id, limit, current_page } = req.query
            const fromCondition = `  
                ${table.v_om_finding_list} vofl 
            `

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            let filterCondition = [
                'vofl.deleted_dt is null'
            ]

            let findingSql =
                `
                    select
                         row_number () over (
                            order by
                            vofl.plan_cm_date
                        )::integer as no,
                        *,
                        case when finding_img is not null then 
                            '${process.env.IMAGE_URL}/file?path=' || finding_img
                        end as finding_img
                    from
                       ${fromCondition}    
                `
            //#region filter
            if (id)
            {
                filterCondition.push(` vofl.finding_id = '${id}' `)
            }
            if (line_id)
            {
                filterCondition.push(` vofl.line_id = '${line_id}' `)
            }
            if (group_id)
            {
                filterCondition.push(` vofl.group_id = '${group_id}' `)
            }
            if (om_item_check_kanban_id)
            {
                filterCondition.push(` vofl.om_item_check_kanban_id = '${om_item_check_kanban_id}' `)
            }
            if (freq_id)
            {
                filterCondition.push(` vofl.freq_id = '${freq_id}' `)
            }
            if (machine_id)
            {
                filterCondition.push(` vofl.machine_id = '${machine_id}' `)
            }
            if (req.query.start_date && req.query.end_date)
            {
                filterCondition.push(` vofl.finding_date between '${req.query.start_date}' and '${req.query.end_date}' `)
            }

            const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

            filterCondition = filterCondition.join(' and ')
            findingSql = findingSql.concat(` where ${filterCondition} `)
            findingSql = findingSql.concat(` order by vofl.created_dt ${qLimit} ${qOffset} `)
            //#endregion

            let findingQuery = await queryCustom(findingSql)
            const nullId = id == null || id == -1 || id == ''
            let result = findingQuery.rows

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
                        list: findingQuery.rows,
                    }
                }
                else
                {
                    result = result[0]
                }
            }

            response.success(res, 'Success to get om finding list', result)
        } catch (error)
        {
            console.log(error);
            response.failed(res, 'Error to get om finding list')
        }
    },
    postOmFinding: async (req, res) => {
        try
        {
            delete req.body.finding_id
            
            let lastCardNumb = (await queryGET(
                table.tb_r_om_findings,
                `order by om_finding_id desc limit 1`,
                [
                    'card_no'
                ]
            ))[0]?.card_no ?? 1

            const insertBody = {
                ...req.body,
                uuid: uuid(),
                line_id: ` (select line_id from ${table.tb_m_lines} where uuid = '${req.body.line_id}') `,
                group_id: ` (select group_id from ${table.tb_m_groups} where uuid = '${req.body.group_id}') `,
                freq_id: ` (select freq_id from ${table.tb_m_freqs} where uuid = '${req.body.freq_id}') `,
                machine_id: ` (select machine_id from ${table.tb_m_machines} where uuid = '${req.body.machine_id}') `,
                om_item_check_kanban_id: ` (select om_item_check_kanban_id from ${table.tb_m_om_item_check_kanbans} where uuid = '${req.body.om_item_check_kanban_id}') `,
                finding_pic_id: ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.finding_pic_id}') `,
                card_no: lastCardNumb + 1
            }

            if (req.body.om_sub_schedule_id)
            {
                insertBody.om_sub_schedule_id = ` (select om_sub_schedule_id from ${table.tb_r_om_sub_schedules} where uuid = '${req.body.om_sub_schedule_id}') `
            }

            if (req.body.actual_pic_id)
            {
                insertBody.actual_pic_id = ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.actual_pic_id}') `
            }

            const transaction = await queryTransaction(async (db) => {
                const attrsInsert = await attrsUserInsertData(req, insertBody)
                return await queryPostTransaction(db, table.tb_r_om_findings, attrsInsert)
            })


            response.success(res, "Success to add om finding", {
                om_finding_id: transaction.rows[0].uuid
            })
        } catch (error)
        {
            logger(error)
            console.log(error)
            response.failed(res, error)
        }
    },
    editOmFinding: async (req, res) => {
        try
        {
            delete req.body.finding_id

            const updateBody = {
                ...req.body,
                line_id: ` (select line_id from ${table.tb_m_lines} where uuid = '${req.body.line_id}') `,
                group_id: ` (select group_id from ${table.tb_m_groups} where uuid = '${req.body.group_id}') `,
                freq_id: ` (select freq_id from ${table.tb_m_freqs} where uuid = '${req.body.freq_id}') `,
                machine_id: ` (select machine_id from ${table.tb_m_machines} where uuid = '${req.body.machine_id}') `,
                om_item_check_kanban_id: ` (select om_item_check_kanban_id from ${table.tb_m_om_item_check_kanbans} where uuid = '${req.body.om_item_check_kanban_id}') `,
                finding_pic_id: ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.finding_pic_id}') `,
            }

            if (req.body.om_sub_schedule_id)
            {
                updateBody.om_sub_schedule_id = ` (select om_sub_schedule_id from ${table.tb_r_om_sub_schedules} where uuid = '${req.body.om_sub_schedule_id}') `
            }
            if (req.body.actual_pic_id)
            {
                updateBody.actual_pic_id = ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.actual_pic_id}') `
            }

            await queryTransaction(async (db) => {
                const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
                return await queryPutTransaction(
                    db,
                    table.tb_r_om_findings,
                    attrsUserUpdate,
                    `WHERE uuid = '${req.params.id}'`
                )
            })

            response.success(res, "Success to edit om finding", {
                om_finding_id: req.params.id
            })
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
    uploadOmImageFinding: async (req, res) => {
        try
        {
            const finding_img = `./${req.file.path}`
            const attrsUserUpdate = await attrsUserUpdateData(req, {
                finding_img: finding_img
            })

            await queryPUT(table.tb_r_om_findings, attrsUserUpdate, `WHERE uuid = '${req.body.om_finding_id}'`);
            response.success(res, 'Success to upload om image finding', req.body.finding_img);
        }
         catch (error)
        {
            response.failed(res, 'Error to upload om image finding ' + error?.message ?? '')
        }
    },
    deleteOmFinding: async (req, res) => {
        try
        {
            let obj = {
                deleted_dt: moment().format().split("+")[0].split("T").join(" "),
                deleted_by: req.user.fullname,
            }

            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(
                table.tb_r_om_findings,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )
            response.success(res, "Success to soft delete om", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
}
