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
    getCategories: async(req, res) => {
        try {
            const categories = await queryGET(table.tb_m_categories, `WHERE ${condDataNotDeleted}`, ['uuid as id', 'category_nm', 'category_desc', 'created_dt', 'created_by'])
            response.success(res, 'Success to get Categories', categories)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get Categories')
        }
    },
    postCategory: async(req, res) => {
        try {
            let idLast = await getLastIdData(table.tb_m_categories, 'category_id') + 1
            req.body.category_id = idLast
            req.body.uuid = req.uuid()

            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_categories, attrsUserInsert)
            response.success(res, 'Success to add category', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editCategory: async(req, res) => {
        try {
            let id = await uuidToId(table.tb_m_categories, 'category_id', req.params.id)
            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_categories, attrsUserUpdate, `WHERE category_id = '${id}'`)
            response.success(res, 'Success to edit category', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteCategory: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_categories, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete category', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }
}