const moment = require("moment")
const { uuid } = require("uuidv4")
const fs = require('fs')
const table = require("../../config/table")
const { queryGET, queryPUT, queryPostTransaction, queryPutTransaction, queryCustom, queryPOST } = require("../../helpers/query")
const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")
const { queryTransaction } = require('../../helpers/query')
const removeFileIfExist = require('../../helpers/removeFileIfExist')
const { mapSchemaPlanKanban4S, genSingleSignCheckerSqlFromSchema } = require('../../services/4s.services')

const uploadDest = (dest = '', fileName = null) => {
    const r = `./uploads/${dest}`
    if (fileName) {
        r.concat(`/${fileName}`)
    }

    return r
}

module.exports = {
    getKanbans: async (req, res) => {
        try {
            let { id, line_id, freq_id, zone_id, limit, current_page } = req.query
            const fromCondition = `  
                ${table.tb_m_kanbans} tmk 
                join ${table.tb_m_zones} tmz on tmk.zone_id = tmz.zone_id 
                join lateral (
                    select * from ${table.tb_m_lines} where line_id = tmz.line_id
                ) tml on tml.line_id = tmz.line_id 
                join ${table.tb_m_freqs} tmf on tmk.freq_id = tmf.freq_id
                join ${table.tb_m_groups} tmg on tmk.group_id = tmg.group_id
            `

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            let filterCondition = [
                'tmk.deleted_dt is null '
            ];

            let kanbanSql = `
                    select
                        row_number () over (
                            order by
                            tmf.precition_val
                        )::integer as no,
                        tml.uuid as line_id,
                        tmz.uuid as zone_id,
                        tmk.uuid as kanban_id,
                        tmf.uuid as freq_id,
                        tmg.uuid as group_id,
                        tml.line_nm,
                        tmf.freq_nm,
                        tmz.zone_nm,
                        tmk.kanban_no,
                        tmk.area_nm,
                        tmk.kanban_imgs,
                        tmg.group_nm,
                        case 
                            when tmk.sop_file is not null and tmk.sop_file != '' then 
                                '${process.env.APP_HOST}' || '/file?path=' || tmk.sop_file
                        end as sop_file,
                        (
                            select count(*) from ${table.tb_m_kanban_revision} where kanban_id = tmk.kanban_id
                        ) as total_revision,
                        tmz.created_by,
                        tmz.created_dt
                    from
                       ${fromCondition}
                    where
                        1 = 1
                `
            //#region filter
            if (id) {
                filterCondition.push(` tmk.uuid = '${id}' `)
            }
            if (line_id) {
                filterCondition.push(` tml.uuid = '${line_id}' `)
            }
            if (zone_id) {
                filterCondition.push(` tmz.uuid = '${zone_id}' `)
            }
            if (freq_id) {
                filterCondition.push(` tmf.uuid = '${freq_id}' `)
            }

            const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

            if (filterCondition.length > 0) {
                filterCondition = filterCondition.join(' and ')
                kanbanSql = kanbanSql.concat(` and ${filterCondition} `)
            }

            kanbanSql = kanbanSql.concat(` order by tmf.precition_val ${qLimit} ${qOffset} `)
            //#endregion

            let kanbanQuery = await queryCustom(kanbanSql)
            const nullId = id == null || id == -1 || id == ''
            let result = kanbanQuery.rows

            if (kanbanQuery.rows.length > 0) {
                kanbanQuery.rows.map((item) => {
                    if (item.kanban_imgs) {
                        item.kanban_imgs = item.kanban_imgs.split('; ').map((img, index) => ({
                            index: index,
                            img: `${process.env.IMAGE_URL}${img}`
                        }))
                    }

                    return item
                })

                if (nullId) {
                    const count = await queryCustom(`select count(tmk.kanban_id)::integer as count from ${fromCondition} where ${filterCondition}`)
                    const countRows = count.rows[0]
                    result = {
                        current_page: current_page,
                        total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +limit) : 0,
                        total_data: countRows.count,
                        limit: limit,
                        list: kanbanQuery.rows,
                    }
                } else {
                    result = result[0]
                }
            }

            response.success(res, "Success to get kanbans", result)
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to get kanbans")
        }
    },
    postKanbans: async (req, res) => {
        try {
            const uploadPath = uploadDest(`${req.body.dest}/`)
            const files = req.files
            let kanban_imgs = []

            if (files && files.length > 0) {
                kanban_imgs = files.map((file) => {
                    return uploadDest(`${req.body.dest}/${file.filename}`)
                })
            }

            try {
                const transaction = await queryTransaction(async (db) => {
                    delete req.body.dest

                    const insertBody = {
                        ...req.body,
                        uuid: uuid(),
                        freq_id: ` (select freq_id from ${table.tb_m_freqs} where uuid = '${req.body.freq_id}') `,
                        zone_id: ` (select zone_id from ${table.tb_m_zones} where uuid = '${req.body.zone_id}') `,
                        group_id: ` (select group_id from ${table.tb_m_groups} where uuid = '${req.body.group_id}') `,
                    }

                    if (kanban_imgs.length > 0) {
                        insertBody.kanban_imgs = kanban_imgs.join('; ')
                    }

                    const attrsInsert = await attrsUserInsertData(req, insertBody)

                    /*  const findLineSql = `select 
                                             tmz.line_id,
                                             tmg.group_id
                                         from 
                                             ${table.tb_m_zones} tmz
                                             join ${table.tb_m_lines} tml on tmz.line_id = tml.line_id 
                                             left join lateral (select * from ${table.tb_m_groups} where is_active = true) tmg on true
                                         where 
                                             tmz.uuid = '${req.body.zone_id}'`
                     const findLineQuery = (await db.query(findLineSql)).rows[0]
 
                     const newScheduleSchema = await mapSchemaPlanKanban4S(
                         findLineQuery.line_id,
                     )
                     const newSignCheckerSchema = await genSingleSignCheckerSqlFromSchema() */
                    return await queryPostTransaction(db, table.tb_m_kanbans, attrsInsert)
                })

                response.success(res, "Success to add kanban", transaction)
            } catch (error) {
                if (kanban_imgs.length > 0) {
                    if (fs.existsSync(uploadPath)) {
                        fs.rmdirSync(uploadPath, { recursive: true })
                    }
                }

                console.log('postKanbans', error)
                response.failed(res, error)
            }
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    editKanbans: async (req, res) => {
        try {
            const files = req.files
            let newKanbanImgs = []

            if (files && files.length > 0) {
                newKanbanImgs = files.map((file) => {
                    return uploadDest(`${req.body.dest}/${file.filename}`)
                })
            }

            let existingKanbans = await queryGET(table.tb_m_kanbans, `WHERE uuid = '${req.params.id}'`, ['kanban_imgs', 'kanban_no'])
            existingKanbans = existingKanbans[0]

            const oldPath = uploadDest(`kanban-${existingKanbans.kanban_no}/`)
            const newPath = uploadDest(`${req.body.dest}/`)

            delete req.body.dest

            try {
                const transaction = await queryTransaction(async (dbPool) => {
                    const { kanban_id, zone_id, freq_id, group_id } = await multipleUUidToIds([
                        {
                            table: table.tb_m_kanbans,
                            col: 'kanban_id',
                            uuid: req.params.id
                        },
                        {
                            table: table.tb_m_zones,
                            col: 'zone_id',
                            uuid: req.body.zone_id
                        },
                        {
                            table: table.tb_m_freqs,
                            col: 'freq_id',
                            uuid: req.body.freq_id
                        },
                        {
                            table: table.tb_m_groups,
                            col: 'group_id',
                            uuid: req.body.group_id
                        }
                    ])

                    const updateBody = {
                        ...req.body,
                        zone_id: zone_id,
                        freq_id: freq_id,
                        group_id
                    }

                    if (newKanbanImgs.length > 0) {
                        updateBody.kanban_imgs = newKanbanImgs.join('; ')

                        // only delete when transaction done and successfully
                        // deleting an file where kanban_no is equal existing kanban
                        if (existingKanbans.kanban_no == req.body.kanban_no) {
                            existingKanbans.kanban_imgs.split('; ').forEach((item) => {
                                if (fs.existsSync(item)) {
                                    fs.unlinkSync(item)
                                }
                            })
                        } else {
                            // delete older path includes file
                            if (fs.existsSync(oldPath)) {
                                fs.rmdirSync(oldPath, { recursive: true })
                            }
                        }
                    }

                    const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
                    return await queryPutTransaction(
                        dbPool,
                        table.tb_m_kanbans,
                        attrsUserUpdate,
                        `WHERE kanban_id = '${kanban_id}'`
                    )
                })

                response.success(res, "Success to edit kanban", transaction)
            } catch (error) {
                if (newKanbanImgs.length > 0) {
                    if (existingKanbans.kanban_no == req.body.kanban_no) {
                        newKanbanImgs.forEach((item) => {
                            if (fs.existsSync(item)) {
                                fs.unlinkSync(item)
                            }
                        })
                    } else {
                        console.log('new path exists', newPath)
                        if (fs.existsSync(newPath)) {
                            console.log('new path exists')
                            fs.rmdirSync(newPath, { recursive: true })
                        }
                    }
                }

                console.log(error)
                response.failed(res, error)
            }
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    deleteKanbans: async (req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split("+")[0].split("T").join(" "),
                deleted_by: req.user.fullname,
            }

            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(
                table.tb_m_kanbans,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )
            response.success(res, "Success to soft delete kanban", result)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    uploadSopFile: async (req, res) => {
        try {
            // handling check if sop file already exists
            // 1. insert into tb_m_kanbans_revision (kanban_rev_id, kanban_id, sop_file, created_by, created_dt)
            // 2. update tb_m_kanbans set sop_file = sop_file, sop_file_before = sop_file_before
            const sop_file = `./${req.file.path}`
            const attrsUserUpdate = await attrsUserUpdateData(req, {
                sop_file: sop_file,
            })
            const attrsUserInsert = await attrsUserInsertData(req, {
                // kanban_rev_id: "SELECT nextval('tb_m_kanban_revision_kanban_rev_id_seq')",
                kanban_id: `(select kanban_id from ${table.tb_m_kanbans} where uuid = '${req.body.kanban_id}')`,
                sop_file: sop_file,
                sop_file_before: `(select sop_file from ${table.tb_m_kanbans} where uuid = '${req.body.kanban_id}')`,
                finding_4s_id: `(select finding_id from ${table.tb_r_4s_findings} where uuid = '${req.body.finding_4s_id}')`,
            })
            if (!req.body.finding_4s_id) delete attrsUserInsert.finding_4s_id
            delete attrsUserInsert.changed_by
            delete attrsUserInsert.changed_dt
            await queryPOST(table.tb_m_kanban_revision, attrsUserInsert)

            await queryPUT(table.tb_m_kanbans, attrsUserUpdate, `WHERE uuid = '${req.body.kanban_id}'`);
            response.success(res, 'Success to upload sop file', {});
        }
        catch (error) {
            response.failed(res, 'Error to upload sop file ' + error?.message ?? '')
        }
    }
}
