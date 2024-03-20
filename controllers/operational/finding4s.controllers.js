const table = require("../../config/table")
const { queryPUT, queryGET, queryCustom, queryPOST } = require("../../helpers/query")

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
            let { id, line_id, limit, current_page, zone_nm } = req.query
            const fromCondition = `  
                ${table.v_4s_finding_list} vfl 
            `

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            let filterCondition = [
                ' and vfl.deleted_dt is null '
            ]

            let kanbanSql = `
                    select
                        *
                    from
                       ${fromCondition}
                    where
                        1 = 1
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
            if (zone_nm)
            {
                filterCondition.push(` vfl.zone_nm = '${zone_nm}' `)
            }

            const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

            filterCondition = filterCondition.join(' and ')
            kanbanSql.concat(` ${filterCondition} `)
            kanbanSql.concat(` order by vfl.created_dt ${qLimit} ${qOffset} `)
            //#endregion

            let kanbanQuery = await queryCustom(kanbanSql)
            const nullId = id == null || id == -1 || id == ''
            let result = kanbanQuery.rows

            if (kanbanQuery.rows.length > 0)
            {
                kanbanQuery.rows.map((item) => {
                    if (item.kanban_imgs)
                    {
                        item.kanban_imgs = item.kanban_imgs.split('; ').map((img, index) => ({
                            index: index,
                            img: img
                        }))
                    }

                    return item
                })

                if (nullId)
                {
                    const count = await queryCustom(`select count(*) as count from ${fromCondition} where 1 = 1 ${filterCondition}`)
                    const countRows = count.rows[0]
                    result = {
                        current_page: current_page,
                        total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +limit) : 0,
                        limit: limit,
                        list: kanbanQuery.rows,
                    }
                }
                else
                {
                    result = result[0]
                }
            }

            response.success(res, 'Success to get 4s finding list', freqs)
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
            }

            const attrsInsert = await attrsUserInsertData(req, insertBody)
            const result = await queryPOST(table.tb_m_freqs, attrsInsert)
            response.success(res, "Success to add freq", result)
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
            }

            const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
            const result = await queryPUT(
                table.tb_m_freqs,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )

            response.success(res, "Success to edit freq", result)
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
                table.tb_m_freqs,
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
