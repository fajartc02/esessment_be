const table = require('../../config/table')
const { queryPOST, queryCustom, queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const condDataNotDeleted = `deleted_dt IS NULL`


module.exports = {
    getUsersOpts: async(req, res) => {
        try {
            const users = await queryGET(table.tb_m_users, `WHERE ${condDataNotDeleted}`, ['uuid as id', 'noreg', 'fullname as text'])
            response.success(res, 'Success to get users', users)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get users')
        }
    }
}