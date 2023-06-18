const table = require('../../config/table')
const { queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const condDataNotDeleted = `deleted_dt IS NULL`


module.exports = {
    getMachines: async(req, res) => {
        try {
            const { line_id } = req.query
            let containerQuery = ``
            let convertLineUUID = await uuidToId(table.tb_m_lines, 'line_id', line_id)
            if (line_id) containerQuery += ` AND line_id = '${convertLineUUID}'`
            const machines = await queryGET(table.tb_m_machines, `WHERE ${condDataNotDeleted}${containerQuery}`)
            response.success(res, 'Success to get Machines', machines)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get Machines')
        }
    }
}