const table = require('../../config/table')
const { queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const condDataNotDeleted = `deleted_dt IS NULL`


module.exports = {
    getCategories: async(req, res) => {
        try {
            const categories = await queryGET(table.tb_m_categories, null, ['uuid as id', 'category_nm'])
            response.success(res, 'Success to get Categories', categories)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get Categories')
        }
    }
}