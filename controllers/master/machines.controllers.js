const table = require('../../config/table')
const { queryGET, queryCustom, queryPOST, queryPUT } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const condDataNotDeleted = `tmm.deleted_dt IS NULL`

const moment = require('moment')


module.exports = {
    getMachines: async(req, res) => {
        try {
            const { line_id, id } = req.query
            let containerQuery = ``
            if (line_id) {
                let convertLineUUID = await uuidToId(table.tb_m_lines, 'line_id', line_id)
                containerQuery += ` AND tml.line_id = '${convertLineUUID}'`
            }
            if (id) {
                containerQuery += ` AND tmm.uuid = '${id}'`
            }
            let q = `SELECT 
                tmm.uuid as id,
                tmm.machine_nm,
                tmm.op_no,
                tml.uuid as line_id,
                tml.line_nm,
                tmm.created_by,
                tmm.created_dt
            FROM ${table.tb_m_machines} tmm
            JOIN ${table.tb_m_lines} tml ON tml.line_id = tmm.line_id
            WHERE
                ${condDataNotDeleted}
                ${containerQuery}`
            const machines = await queryCustom(q)
                // const machines = await queryGET(table.tb_m_machines, `WHERE ${condDataNotDeleted}${containerQuery}`)
            response.success(res, 'Success to get Machines', machines.rows)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get Machines')
        }
    },
    postMachine: async(req, res) => {
        try {
            let idLast = await getLastIdData(table.tb_m_machines, 'machine_id') + 1
            req.body.machine_id = idLast
            req.body.uuid = req.uuid()
            let idLine = await uuidToId(table.tb_m_lines, 'line_id', req.body.line_id)
            req.body.line_id = idLine
            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_machines, attrsUserInsert)
            response.success(res, 'Success to add machine', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editMachine: async(req, res) => {
        try {
            let id = await uuidToId(table.tb_m_machines, 'machine_id', req.params.id)
            let idLine = await uuidToId(table.tb_m_lines, 'line_id', req.body.line_id)
            req.body.line_id = idLine

            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_machines, attrsUserUpdate, `WHERE machine_id = '${id}'`)
            response.success(res, 'Success to edit machine', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteMachine: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_machines, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete machine', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }
}