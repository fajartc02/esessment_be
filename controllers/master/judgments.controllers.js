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
    getJudgmentsOpts: async(req, res) => {
        try {
            const judgments = await queryGET(table.tb_m_judgments, `WHERE ${condDataNotDeleted}`, ['uuid as id', 'judgment_nm as text', 'is_abnormal'])
            response.success(res, 'Success to get judgments', judgments)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get judgments')
        }
    },
    postJudgment: async(req, res) => {
        try {
            let idLast = await getLastIdData(table.tb_m_judgments, 'judgment_id') + 1
            req.body.judgment_id = idLast
            req.body.uuid = req.uuid()

            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_judgments, attrsUserInsert)
            response.success(res, 'Success to add judgment', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editJudgment: async(req, res) => {
        try {
            let id = await uuidToId(table.tb_m_judgments, 'judgment_id', req.params.id)
            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_judgments, attrsUserUpdate, `WHERE judgment_id = '${id}'`)
            response.success(res, 'Success to edit judgment', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteJudgment: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_judgments, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete judgment', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }
}