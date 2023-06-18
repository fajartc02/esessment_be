const table = require('../../config/table')
const { queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const condDataNotDeleted = `deleted_dt IS NULL`


module.exports = {
    getJobType: async(req, res) => {
        try {
            const jobType = await queryGET(table.tb_m_job_types, `WHERE ${condDataNotDeleted}`)
            response.success(res, 'Success to get jobType', jobType)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get jobType')
        }
    }
}