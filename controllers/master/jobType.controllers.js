const table = require('../../config/table')
const { queryGET, queryPOST, queryPUT } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const condDataNotDeleted = `WHERE deleted_dt IS NULL`

const moment = require('moment')


module.exports = {
    getJobType: async(req, res) => {
        try {
            const jobType = await queryGET(table.tb_m_job_types, `${condDataNotDeleted}`, ['uuid as id', 'job_type_nm', 'colors', 'created_dt', 'created_by'])
            response.success(res, 'Success to get jobType', jobType)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get jobType')
        }
    },
    postJobType: async(req, res) => {
        try {
            let idLast = await getLastIdData(table.tb_m_job_types, 'job_type_id') + 1
            req.body.job_type_id = idLast
            req.body.uuid = req.uuid()

            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_job_types, attrsUserInsert)
            response.success(res, 'Success to add job type', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editJobType: async(req, res) => {
        try {
            let id = await uuidToId(table.tb_m_job_types, 'job_type_id', req.params.id)
            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_job_types, attrsUserUpdate, `WHERE job_type_id = '${id}'`)
            response.success(res, 'Success to edit job type', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteJobType: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_job_types, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete job type', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }
}