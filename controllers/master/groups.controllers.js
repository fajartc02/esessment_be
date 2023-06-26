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
    getGroups: async(req, res) => {
        try {
            const groups = await queryGET(table.tb_m_groups, condDataNotDeleted, ['uuid as id', 'group_nm', 'created_by', 'created_dt'])
            response.success(res, 'Success to get groups', groups)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get groups')
        }
    },
    postGroup: async(req, res) => {
        try {
            let idLast = await getLastIdData(table.tb_m_groups, 'group_id') + 1
            req.body.group_id = idLast
            req.body.uuid = req.uuid()

            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_groups, attrsUserInsert)
            response.success(res, 'Success to add group', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editGroup: async(req, res) => {
        try {
            let id = await uuidToId(table.tb_m_groups, 'group_id', req.params.id)
            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_groups, attrsUserUpdate, `WHERE group_id = '${id}'`)
            response.success(res, 'Success to edit group', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteGroup: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_groups, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete group', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }
}