const table = require('../../config/table')
const { queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const condDataNotDeleted = `WHERE deleted_dt IS NULL`


module.exports = {
    getGroups: async(req, res) => {
        try {
            const groups = await queryGET(table.tb_m_groups, condDataNotDeleted, ['uuid as id', 'group_nm as text'])
            response.success(res, 'Success to get groups', groups)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get groups')
        }
    }
}