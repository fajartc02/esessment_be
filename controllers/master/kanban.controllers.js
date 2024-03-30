const moment = require("moment")
const { uuid } = require("uuidv4")
const fs = require('fs')
const table = require("../../config/table")
const { queryGET, queryPUT, queryPostTransaction, queryPutTransaction, queryCustom } = require("../../helpers/query")
const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")
const { queryTransaction } = require('../../helpers/query')
const removeFileIfExist = require('../../helpers/removeFileIfExist')

const uploadDest = (dest = '', fileName = null) => {
    const r = `./uploads/${dest}`
    if (fileName)
    {
        r.concat(`/${fileName}`)
    }

    return r
}

module.exports = {
    getKanbans: async (req, res) => {
        try
        {
            let { id, line_id, freq_id, zone_id, limit, current_page } = req.query
            const fromCondition = `  
                ${table.tb_m_kanbans} tmk 
                join ${table.tb_m_zones} tmz on tmk.zone_id = tmz.zone_id 
                join lateral (
                    select * from ${table.tb_m_lines} where line_id = tmz.line_id
                ) tml on tml.line_id = tmz.line_id 
                join ${table.tb_m_freqs} tmf on tmk.freq_id = tmf.freq_id
            `

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            let filterCondition = [
                'tmk.deleted_dt is null '
            ]

            let kanbanSql = `
                    select
                        row_number () over (
                            order by
                            tmk.created_dt
                        )::integer as no,
                        tml.uuid as line_id,
                        tmz.uuid as zone_id,
                        tmk.uuid as kanban_id,
                        tmf.uuid as freq_id,
                        tml.line_nm,
                        tmf.freq_nm,
                        tmz.zone_nm,
                        tmk.kanban_no,
                        tmk.area_nm,
                        tmk.kanban_imgs,
                        tmz.created_by,
                        tmz.created_dt
                    from
                       ${fromCondition}
                    where
                        1 = 1
                `
            //#region filter
            if (id)
            {
                filterCondition.push(` tmk.uuid = '${id}' `)
            }
            if (line_id)
            {
                filterCondition.push(` tml.uuid = '${line_id}' `)
            }
            if (zone_id)
            {
                filterCondition.push(` tmz.uuid = '${zone_id}' `)
            }
            if (freq_id)
            {
                filterCondition.push(` tmf.uuid = '${freq_id}' `)
            }

            const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

            if (filterCondition.length > 0)
            {
                filterCondition = filterCondition.join(' and ')
                kanbanSql = kanbanSql.concat(` and ${filterCondition} `)
            }

            kanbanSql = kanbanSql.concat(` order by tmk.created_dt ${qLimit} ${qOffset} `)
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
                            img: `${process.env.IMAGE_URL}/file?path=${img}`
                        }))
                    }

                    return item
                })

                if (nullId)
                {
                    const count = await queryCustom(`select count(tmk.kanban_id)::integer as count from ${fromCondition} where ${filterCondition}`)
                    const countRows = count.rows[0]
                    result = {
                        current_page: current_page,
                        total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +limit) : 0,
                        total_data: countRows.count,
                        limit: limit,
                        list: kanbanQuery.rows,
                    }
                }
                else
                {
                    result = result[0]
                }
            }

            response.success(res, "Success to get kanbans", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, "Error to get kanbans")
        }
    },
    postKanbans: async (req, res) => {
        const uploadPath = uploadDest(`${req.body.dest}/`)
        try
        {
            const files = req.files
            const kanban_imgs = files.map((file) => {
                return uploadDest(`${req.body.dest}/${file.filename}`)
            })

            delete req.body.dest

            const transaction = await queryTransaction(async (db) => {
                const insertBody = {
                    ...req.body,
                    uuid: uuid(),
                    freq_id: ` (select freq_id from ${table.tb_m_freqs} where uuid = '${req.body.freq_id}') `,
                    zone_id: ` (select zone_id from ${table.tb_m_zones} where uuid = '${req.body.zone_id}') `,
                    kanban_imgs: kanban_imgs.join('; ')
                }

                const attrsInsert = await attrsUserInsertData(req, insertBody)
                return await queryPostTransaction(db, table.tb_m_kanbans, attrsInsert)
            })

            response.success(res, "Success to add kanban", transaction)
        }
        catch (error)
        {
            if (fs.existsSync(uploadPath))
            {
                fs.rmdirSync(uploadPath, { recursive: true })
            }

            console.log('postKanbans', error)
            response.failed(res, error)
        }
    },
    editKanbans: async (req, res) => {
        try
        {
            const files = req.files
            const newKanbanImgs = files.map((file) => {
                return uploadDest(`${req.body.dest}/${file.filename}`)
            })

            let existingKanbans = await queryGET(table.tb_m_kanbans, `WHERE uuid = '${req.params.id}'`, ['kanban_imgs', 'kanban_no'])
            existingKanbans = existingKanbans[0]

            const oldPath = uploadDest(`kanban-${existingKanbans.kanban_no}/`)
            const newPath = uploadDest(`${req.body.dest}/`)

            delete req.body.dest

            try
            {
                const transaction = await queryTransaction(async (dbPool) => {
                    const { kanban_id, zone_id, freq_id } = await multipleUUidToIds([
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
                    ])

                    const updateBody = {
                        ...req.body,
                        zone_id: zone_id,
                        freq_id: freq_id,
                        kanban_imgs: newKanbanImgs.join('; ')
                    }


                    // only delete when transaction done and successfully
                    // deleting an file where kanban_no is equal existing kanban
                    if (existingKanbans.kanban_no == req.body.kanban_no)
                    {
                        existingKanbans.kanban_imgs.split('; ').forEach((item) => {
                            if (fs.existsSync(item))
                            {
                                fs.unlinkSync(item)
                            }
                        })
                    }
                    else
                    {
                        // delete older path includes file
                        if (fs.existsSync(oldPath))
                        {
                            fs.rmdirSync(oldPath, { recursive: true })
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
            }
            catch (error)
            {
                console.log('existing vs new', {
                    exist: existingKanbans.kanban_no,
                    new: req.body.kanban_no
                })

                if (existingKanbans.kanban_no == req.body.kanban_no)
                {
                    newKanbanImgs.forEach((item) => {
                        if (fs.existsSync(item))
                        {
                            fs.unlinkSync(item)
                        }
                    })
                }
                else
                {
                    console.log('new path exists', newPath)
                    if (fs.existsSync(newPath))
                    {
                        console.log('new path exists')
                        fs.rmdirSync(newPath, { recursive: true })
                    }
                }

                console.log(error)
                response.failed(res, error)
            }
        }
        catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }


    },
    deleteKanbans: async (req, res) => {
        try
        {
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
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
}
