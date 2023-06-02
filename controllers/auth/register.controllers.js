const { tb_m_users, tb_m_lines, tb_m_groups } = require('../../config/table')
const { queryPOST } = require('../../helpers/query')
const security = require('../../helpers/security')
const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const { v4 } = require('uuid');
const uuidToId = require('../../helpers/uuidToId')


const register = async(req, res) => {
    try {
        let idLast = await getLastIdData(tb_m_users, 'user_id') + 1
        req.body.user_id = idLast
        let unreadPassword = await security.encryptPassword(req.body.password)
        req.body.password = unreadPassword
        req.body.uuid = v4()
        req.body.line_id = await uuidToId(tb_m_lines, 'line_id', req.body.line_id)
        req.body.group_id = await uuidToId(tb_m_groups, 'group_id', req.body.group_id)
        req.body.is_activated = false
        console.log(req.body);
        await queryPOST(tb_m_users, req.body)
            .then((result) => {
                response.success(res, 'Success to create User', result)
            })
    } catch (error) {
        console.log(error);
        response.notAllowed(res, error)
    }
}

module.exports = {
    register
}