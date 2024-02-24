const table = require('../../config/table')
const { queryPOST, queryCustom, queryGET, queryPUT } = require('../../helpers/query')
const response = require('../../helpers/response')

const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const addAttrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')

const queryCondExacOpAnd = require('../../helpers/conditionsQuery')
const removeFileIfExist = require('../../helpers/removeFileIfExist')
const uuidToId = require('../../helpers/uuidToId')
const condDataNotDeleted = `WHERE deleted_dt IS NULL AND `


module.exports = {
    getFindingCm: async(req, res) => {
        try {
            let { start_date, end_date, line_id, limit, currentPage } = req.query
            let qLimit = ``
            let qOffset = (limit != -1 && limit) && currentPage > 1 ? `OFFSET ${limit * (currentPage - 1)}` : ``
            if (limit != -1 && limit) qLimit = `LIMIT ${limit}`
            let conditions = queryCondExacOpAnd(req.query, 'finding_date');
            let findingCmData = await queryGET(table.v_finding_list, `WHERE ${conditions} ORDER BY finding_date DESC ${qLimit} ${qOffset}`)
            let qCountTotal = `SELECT 
            count(finding_id) as total_page
        FROM ${table.v_finding_list}
        ${condDataNotDeleted}
        ${conditions}`
            let total_page = await queryCustom(qCountTotal)
            let totalPage = await total_page.rows[0].total_page
            if (findingCmData.length > 0) {
                findingCmData[0].total_page = +totalPage > 0 ? Math.ceil(totalPage / +limit) : 1
                findingCmData[0].limit = +limit
            }

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

            let finding_id = `${await uuidToId(table.tb_r_findings, 'finding_id', req.body.finding_id)}`
            if (req.body.before_path != null && req.body.before_path != 'null' && req.body.before_path) {
                removeFileIfExist(req.body.before_path)
            }

            delete req.body.dest
            delete req.body.finding_id
            delete req.body.before_path

            // Update tb_r_finding SET file_pinksheet = req.file.path
            await queryPUT(table.tb_r_findings, req.body, `WHERE finding_id = '${finding_id}'`);
            response.success(res, 'Success to upload pinksheet', req.body.file_pinksheet);
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to upload kaizen report')
        }
    },
    uploadImageFinding: async(req, res) => {
        try {
            let resFile = `./${req.file.path}`
            if (req.body.before_path != null && req.body.before_path != 'null' && req.body.before_path) {
                removeFileIfExist(req.body.before_path);
                response.success(res, 'success to edit file', resFile)
            } else {
                response.success(res, 'success to upload file', resFile)
            }
        } catch (error) {
            response.failed(res, 'Error to Upload finding Image')
        }
    }
}