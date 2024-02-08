const table = require('../../config/table')
const { queryPOST, queryCustom, queryGET, queryPUT } = require('../../helpers/query')
const response = require('../../helpers/response')

const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const addAttrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')

const queryCondExacOpAnd = require('../../helpers/conditionsQuery')


module.exports = {
    getFindingCm: async(req, res) => {
        try {
            let conditions = queryCondExacOpAnd(req.query, 'finding_date');
            let findingCmData = await queryGET(table.v_finding_list, `WHERE ${conditions}`)

            response.success(res, 'Success to get findingCm list', findingCmData)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get findingCm list')
        }
    },
    uploadPinksheet: async(req, res) => {
        try {
            if (req.file) {
                req.body.file_pinksheet = `./${req.file.path}`
            }
            let resFindingId = req.body.result_finding_id
            delete req.body.dest
            delete req.body.result_finding_id
            console.log(req.body);
            await queryPUT(table.tb_r_result_findings, req.body, `WHERE uuid = '${resFindingId}'`);
            response.success(res, 'Success to upload pinksheet');
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to upload kaizen report')
        }
    }
}