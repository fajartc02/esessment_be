const table = require('../../config/table')
const { queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const condDataNotDeleted = `deleted_dt IS NULL`


module.exports = {
    getLinesOpts: async(req, res) => {
        try {
            const lines = await queryGET(table.tb_m_lines, null, ['uuid as id', 'line_nm as text'])
            response.success(res, 'Success to get Lines', lines)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get Lines')
        }
    }
}