const table = require("../../config/table")
const {
    queryPUT,
    queryCustom,
    queryPOST,
    queryPostTransaction,
    queryPutTransaction,
    queryTransaction,
    queryGET
} = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")

const fs = require('fs')
const moment = require("moment")
const { uuid } = require("uuidv4")

const historyItemCheckServices = require("../../services/historyItemCheckKanban4s.services");

const uploadDest = (dest = '', fileName = null) => {
    const r = `./uploads/${dest}`
    if (fileName) {
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
    getItemCheckKanbans: async (req, res) => {
        try {
            let { id, kanban_id, limit, current_page } = req.query
            const fromCondition = ` 
                        ${table.tb_m_4s_item_check_kanbans} tmic
                        join ${table.tb_m_kanbans} tmk on tmic.kanban_id = tmk.kanban_id 
                        ${historyItemCheckServices.leftJoinLateralLast('tmic')}
                        ${historyItemCheckServices.leftJoinLateralLast('tmic', { isCount: true, optionalAlias: 'trh4sick_count' })}
                `
            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            let filterCondition = [
                ' and tmic.deleted_dt is null '
            ]
            console.log('HERE');


            // let itemCheckQuery = `
            //        select
            //             row_number () over (
            //                 order by
            //                 tmic.created_dt
            //             )::integer as no,
            //             tmic.uuid as item_check_kanban_id,
            //             tmk.uuid as kanban_id,
            //             tmk.kanban_no,
            //             tmic.item_check_nm,
            //             tmic.standart_time,
            //             tmic.method,
            //             tmic.control_point,
            //             tmic.ilustration_imgs,
            //             tmic.created_by,
            //             tmic.created_dt,
            //             trh4sick.standart_time as before_standart_time,
            //             trh4sick_count.total_history
            //         from
            //             ${fromCondition}
            //         where
            //             1 = 1
            //     `
            let itemCheckQuery = `
            WITH latest_history AS (
                SELECT DISTINCT ON (item_check_kanban_id)
                    item_check_kanban_id,
                    standart_time
                FROM tb_r_history_4s_item_check_kanbans
                ORDER BY item_check_kanban_id, created_dt DESC
            ),
            history_counts AS (
                SELECT
                    item_check_kanban_id,
                    COUNT(*)::real AS total_history
                FROM tb_r_history_4s_item_check_kanbans
                GROUP BY item_check_kanban_id
            )
            SELECT
                row_number() OVER (ORDER BY tmic.created_dt)::integer AS no,
                tmic.uuid AS item_check_kanban_id,
                tmk.uuid AS kanban_id,
                tmk.kanban_no,
                tmic.item_check_nm,
                tmic.standart_time,
                tmic.method,
                tmic.control_point,
                tmic.ilustration_imgs,
                tmic.created_by,
                tmic.created_dt,
                lh.standart_time AS before_standart_time,
                hc.total_history
            FROM tb_m_4s_item_check_kanbans tmic
            JOIN tb_m_kanbans tmk ON tmic.kanban_id = tmk.kanban_id
            LEFT JOIN latest_history lh ON lh.item_check_kanban_id = tmic.item_check_kanban_id
            LEFT JOIN history_counts hc ON hc.item_check_kanban_id = tmic.item_check_kanban_id
            WHERE 1 = 1
            `
            //#region filter
            if (id) {
                filterCondition.push(` tmic.uuid = '${id}' `)
            }
            if (kanban_id) {
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

            if (result.length > 0) {
                result.map((item) => {
                    if (item.ilustration_imgs) {
                        item.ilustration_imgs = item.ilustration_imgs.split('; ').map((img, index) => ({
                            index: index,
                            img: `${process.env.IMAGE_URL}${img}`,
                            path: img,
                            is_deleted: false
                        }))
                    }

                    return item
                })

                if (nullId) {
                    // const count = await queryCustom(`select count(tmic.item_check_kanban_id)::integer as count from ${fromCondition} where 1 = 1 ${filterCondition}`)
                    const count = await queryCustom(`
                        WITH latest_history AS (
                            SELECT DISTINCT ON (item_check_kanban_id)
                                item_check_kanban_id,
                                created_dt
                            FROM tb_r_history_4s_item_check_kanbans
                            ORDER BY item_check_kanban_id, created_dt DESC
                        ),
                        history_counts AS (
                            SELECT
                                item_check_kanban_id,
                                COUNT(*)::real AS total_history
                            FROM tb_r_history_4s_item_check_kanbans
                            GROUP BY item_check_kanban_id
                        )
                        SELECT COUNT(tmic.item_check_kanban_id)::integer AS count
                        FROM tb_m_4s_item_check_kanbans tmic
                        JOIN tb_m_kanbans tmk ON tmic.kanban_id = tmk.kanban_id
                        LEFT JOIN latest_history trh4sick ON trh4sick.item_check_kanban_id = tmic.item_check_kanban_id
                        LEFT JOIN history_counts trh4sick_count ON trh4sick_count.item_check_kanban_id = tmic.item_check_kanban_id
                        WHERE 1 = 1 ${filterCondition};
                    `)
                    const countRows = count.rows[0]
                    result = {
                        current_page: current_page,
                        total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +limit) : 0,
                        total_data: countRows.count,
                        limit: limit,
                        list: itemChecks.rows,
                    }
                } else {
                    result = result[0]
                }
            }

            response.success(res, "Success to get item check kanbans", result)
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to get item check kanbans")
        }
    },
    postItemCheck: async (req, res) => {
        try {
            const uploadPath = uploadDest(`${req.body.dest}/`)
            const existing = await queryGET(
                table.tb_m_4s_item_check_kanbans,
                `where kanban_id = (select kanban_id from ${table.tb_m_kanbans} where uuid = '${req.body.kanban_id}') and item_check_nm = '${req.body.item_check_nm}'`,
                [
                    'item_check_kanban_id'
                ]
            )

            const files = req.files
            let ilustration_imgs = []
            if (files && files.length > 0) {
                ilustration_imgs = files.map((file) => {
                    return uploadDest(`${req.body.dest}/${file.filename}`)
                })
            }

            try {
                const transaction = await queryTransaction(async (db) => {
                    delete req.body.dest

                    const insertBody = {
                        ...req.body,
                        uuid: uuid(),
                        kanban_id: ` (select kanban_id from ${table.tb_m_kanbans} where uuid = '${req.body.kanban_id}') `,
                    }

                    if (ilustration_imgs.length > 0) {
                        insertBody.ilustration_imgs = ilustration_imgs.join('; ')
                    }

                    console.log('postItemCheck insertBody', insertBody)

                    const attrsInsert = await attrsUserInsertData(req, insertBody)

                    return await queryPostTransaction(db, table.tb_m_4s_item_check_kanbans, attrsInsert)
                })

                response.success(res, "Success to add item check kanban", transaction)
            } catch (error) {
                console.log('postItemCheck', error)

                if (ilustration_imgs.length > 0) {
                    //determine not deleting existing path when exists
                    if (existing.length == 0) {
                        if (fs.existsSync(uploadPath)) {
                            fs.rmdirSync(uploadPath, { recursive: true })
                        }
                    }

                }

                if (error.code == '23505') {
                    response.failed(res, 'Duplicate! Item check kanban name within kanban_id already exists')
                } else {
                    response.failed(res, error)
                }
            }
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    editItemCheck: async (req, res) => {
        try {
            let existing = await queryGET(
                table.tb_m_4s_item_check_kanbans,
                `where uuid = '${req.params.id}'`,
                [
                    'item_check_kanban_id',
                    'ilustration_imgs',
                    'item_check_nm',
                    'kanban_id'
                ]
            )

            existing = existing[0]

            const files = req.files
            let newIlustrationImgs = []

            if (files && files != null && files != 'null' && files.length > 0) {
                newIlustrationImgs = files.map((file) => {
                    return uploadDest(`${req.body.dest}/${file.filename}`)
                })
            }

            // getter the old path within split the forward slash
            const oldDest = existing.ilustration_imgs ? existing.ilustration_imgs.split('; ')[0].split('/')[2] : ''
            const newDest = req.body.dest

            console.info('req.body.previous_img_paths', typeof req.body.previous_img_paths)

            /**
             * @type {Array<String>}
             */
            let previousImgPath = req.body.previous_img_paths
                && req.body.previous_img_paths != null
                && req.body.previous_img_paths != 'null'
                && req.body.previous_img_paths != ''
                ? JSON.parse(req.body.previous_img_paths) ?? []
                : []

            try {
                const transaction = await queryTransaction(async (db) => {
                    delete req.body.dest
                    delete req.body.previous_img_paths

                    const updateBody = {
                        ...req.body,
                        kanban_id: ` (select kanban_id from ${table.tb_m_kanbans} where uuid = '${req.body.kanban_id}') `,
                    }

                    let ilustration_imgs = []
                    if (previousImgPath && previousImgPath.length > 0) {
                        const deleteds = previousImgPath.filter((path) => {
                            return path.is_deleted
                        })

                        if (deleteds.length > 0) {
                            deleteds.forEach((d) => {
                                if (fs.existsSync(d.path)) {
                                    fs.unlinkSync(d.path)
                                }
                            })
                        }

                        ilustration_imgs = previousImgPath
                            .filter((path) => {
                                return !path.is_deleted
                            })
                            .map((img) => {
                                return img.path
                            })
                    }

                    if (newIlustrationImgs.length > 0) {
                        /* if (existing.ilustration_imgs && existing.ilustration_imgs.split('; ').length > 0)
                        {
                            if (oldDest == newDest)
                            {
                                existing.ilustration_imgs.split('; ').forEach((item) => {
                                    if (fs.existsSync(item))
                                    {
                                        fs.unlinkSync(item)
                                    }
                                })
                            }
                            else
                            {
                                if (fs.existsSync(uploadDest(`${oldDest}/`)))
                                {
                                    fs.rmdirSync(uploadDest(`${oldDest}/`), { recursive: true })
                                }
                            }
                        } */
                        newIlustrationImgs.forEach((n) => {
                            ilustration_imgs.push(n)
                        })
                    }

                    if (ilustration_imgs.length > 0) {
                        updateBody.ilustration_imgs = ilustration_imgs.join('; ')
                    }

                    const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)

                    return await queryPutTransaction(
                        db,
                        table.tb_m_4s_item_check_kanbans,
                        attrsUserUpdate,
                        `WHERE uuid = '${req.params.id}'`
                    )
                })

                response.success(res, "Success to edit item check kanban", transaction)
            } catch (error) {
                if (newIlustrationImgs.length > 0) {
                    if (oldDest == newDest) {
                        newIlustrationImgs.forEach((item) => {
                            if (fs.existsSync(item)) {
                                fs.unlinkSync(item)
                            }
                        })
                    } else {
                        if (fs.existsSync(uploadDest(`${newDest}/`))) {
                            fs.rmdirSync(uploadDest(`${newDest}/`), { recursive: true })
                        }
                    }
                }

                if (error.code == '23505') {
                    response.failed(res, 'Duplicate! Item check kanban name within kanban_id already exists')
                } else {
                    console.log('editItemCheck', error)
                    response.failed(res, error)
                }
            }
        } catch (error) {
            console.log('editItemCheck', error)
            response.failed(res, error)
        }
    },
    deleteItemCheck: async (req, res) => {
        try {
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
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    getHistoryItemCheckKanbans: async (req, res) => {
        try {
            const result = await historyItemCheckServices.query.findDynamic({
                ...req.query,
                item_check_kanban_id: req.params.item_check_kanban_id
            });
            response.success(res, "Success to get history item check kanban 4S", result);
        } catch (error) {
            console.log(error)
            response.failed(res, `error to get detail history item check kanban 4S, Detail >>> ${error}`);
        }
    },
}
