const table = require('../../config/table')
const { queryPOST, queryCustom, queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const condDataNotDeleted = `deleted_dt IS NULL`


module.exports = {
    getFactorsOpts: async(req, res) => {
        try {
            const factors = await queryGET(table.tb_m_factors, `WHERE ${condDataNotDeleted}`, ['uuid as id', 'factor_nm as text'])
            response.success(res, 'Success to get factors', factors)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get factors')
        }
    }
}