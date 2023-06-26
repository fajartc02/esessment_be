const table = require('../../config/table')
const { queryGET, queryPOST, queryPUT } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const condDataNotDeleted = `deleted_dt IS NULL`

const moment = require('moment')


module.exports = {
    getLinesOpts: async(req, res) => {
        try {
            const lines = await queryGET(table.tb_m_lines, `WHERE ${condDataNotDeleted}`, ['uuid as id', 'line_nm', 'line_snm', 'created_by', 'created_dt'])
            response.success(res, 'Success to get Lines', lines)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get Lines')
        }
    },
    postLine: async(req, res) => {
        try {
            let idLast = await getLastIdData(table.tb_m_lines, 'line_id') + 1
            req.body.line_id = idLast
            req.body.uuid = req.uuid()
            let idShop = await uuidToId(table.tb_m_shop, 'shop_id', req.body.shop_id)
            req.body.shop_id = idShop
            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_lines, attrsUserInsert)
            response.success(res, 'Success to add line', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editLine: async(req, res) => {
        try {
            let id = await uuidToId(table.tb_m_lines, 'line_id', req.params.id)
            let idshop = await uuidToId(table.tb_m_shop, 'shop_id', req.body.shop_id)
            req.body.shop_id = idshop

            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_lines, attrsUserUpdate, `WHERE line_id = '${id}'`)
            response.success(res, 'Success to edit line', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteLine: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_lines, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete line', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }

}