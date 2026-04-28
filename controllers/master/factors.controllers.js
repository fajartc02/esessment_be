const table = require('../../config/table')
const { queryPOST, queryPUT, queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const condDataNotDeleted = `deleted_dt IS NULL`

const moment = require('moment')


module.exports = {
    getFactorsOpts: async(req, res) => {
        try {
            const factors = await queryGET(table.tb_m_factors, `WHERE ${condDataNotDeleted}`, ['uuid as id', 'factor_nm as text', 'created_by', 'created_dt'])
            response.success(res, 'Success to get factors', factors)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get factors')
        }
    },
    postFactor: async(req, res) => {
        try {
            let idLast = await getLastIdData(table.tb_m_factors, 'factor_id') + 1
            req.body.factor_id = idLast
            req.body.uuid = req.uuid()

            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_factors, attrsUserInsert)
            response.success(res, 'Success to add factor', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editFactor: async(req, res) => {
        try {
            let id = await uuidToId(table.tb_m_factors, 'factor_id', req.params.id)
            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_factors, attrsUserUpdate, `WHERE factor_id = '${id}'`)
            response.success(res, 'Success to edit factor', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteFactor: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_factors, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete factor', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }

}