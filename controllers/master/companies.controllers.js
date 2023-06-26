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
    getCompanies: async(req, res) => {
        try {
            const companies = await queryGET(table.tb_m_companies, `WHERE ${condDataNotDeleted}`, ['uuid as id', 'company_nm', 'created_by', 'created_dt'])
            response.success(res, 'Success to get companies', companies)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get companies')
        }
    },
    postCompany: async(req, res) => {
        try {
            let idLast = await getLastIdData(table.tb_m_companies, 'company_id') + 1
            req.body.company_id = idLast
            req.body.uuid = req.uuid()

            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_companies, attrsUserInsert)
            response.success(res, 'Success to add company', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editCompany: async(req, res) => {
        try {
            let id = await uuidToId(table.tb_m_companies, 'company_id', req.params.id)
            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_companies, attrsUserUpdate, `WHERE company_id = '${id}'`)
            response.success(res, 'Success to edit company', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteCompany: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_companies, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete company', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }

}