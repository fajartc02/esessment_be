const moment = require('moment')
const table = require('../../config/table')
const { queryPOST, queryCustom, queryGET, queryPUT, queryDELETE } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const condDataNotDeleted = `WHERE tmp.deleted_dt IS NULL`
const orderBy = `ORDER BY cast(NULLIF(regexp_replace(pos_nm, '\D', '', 'g'), '') AS integer)`

const fs = require('fs')
const { arrayOrderBy } = require('../../helpers/formatting')


module.exports = {
    getPos: async(req, res) => {
        try {
            let { id, line_id, pos_id } = req.query
            let containerQuery = ''
            if (id && id != -1 && id != 'null') containerQuery += ` AND tmp.uuid = '${id}'`
            if (line_id && line_id != -1 && line_id != 'null') containerQuery += ` AND tml.uuid = '${line_id}'`
            if (pos_id && pos_id != -1 && pos_id != 'null') containerQuery += ` AND tmp.uuid = '${pos_id}'`
            let q = `
                SELECT 
                    tmp.uuid as id,
                    tmp.pos_nm,
                    tmp.created_dt,
                    tmp.created_by,
                    tml.uuid as line_id,
                    tml.line_nm,
                    tmp.tsk,
                    tmp.tskk
                FROM ${table.tb_m_pos} tmp
                JOIN ${table.tb_m_lines} tml ON tmp.line_id = tml.line_id
                ${condDataNotDeleted}
                ${containerQuery}
                ${orderBy}
            `
            const pos = await queryCustom(q)

            response.success(res, 'Success to get pos', arrayOrderBy(pos.rows, pos => pos.pos_nm))
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get pos')
        }
    },
    postPos: async(req, res) => {
        try {
            let tsk = req.files.tsk
            let tskk = req.files.tskk
            console.log('TSK', req.files.tsk);
            console.log('TSKK', req.files.tskk);
            let idLast = await getLastIdData(table.tb_m_pos, 'pos_id') + 1
            req.body.pos_id = idLast
            req.body.uuid = req.uuid()
            let convertUUID = await uuidToId(table.tb_m_lines, 'line_id', req.body.line_id)
            req.body.line_id = convertUUID
            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            console.log(attrsUserInsert);
            if (tsk) {
                req.body.tsk = `./${req.files.tsk[0].path}`
            }
            if (tskk) {
                req.body.tskk = `./${req.files.tskk[0].path}`
            }
            delete req.body.dest
            const result = await queryPOST(table.tb_m_pos, attrsUserInsert)
            response.success(res, 'Success to add pos', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editPos: async(req, res) => {
        try {
            console.log('TSK', req.files);
            console.log('TSKK', req.files.tskk);
            let convertUUID = await uuidToId(table.tb_m_lines, 'line_id', req.body.line_id)
            req.body.line_id = convertUUID

            if (req.files.tsk) {
                const pos = await queryGET(table.tb_m_pos, `WHERE uuid = '${req.params.id}'`, ['tsk'])
                if (pos[0].tsk) {
                    fs.unlink(pos[0].tsk, function(err) {
                        console.log(err);
                    })
                }
                req.files.tsk ? req.body.tsk = `./${req.files.tsk[0].path}` : null
            }
            if (req.files.tskk) {
                const pos = await queryGET(table.tb_m_pos, `WHERE uuid = '${req.params.id}'`, ['tskk'])
                if (pos[0].tskk) {
                    fs.unlink(pos[0].tskk, function(err) {
                        console.log(err);
                    })
                }
                req.files.tskk ? req.body.tskk = `./${req.files.tskk[0].path}` : null
            }
            delete req.body.dest
            let attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_pos, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to edit pos', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deletePos: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_pos, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete pos', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }
}