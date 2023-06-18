const moment = require('moment')
const table = require('../../config/table')
const { queryPOST, queryCustom, queryGET, queryPUT, queryDELETE } = require('../../helpers/query')
const fs = require('fs')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const condDataNotDeleted = `WHERE tmj.deleted_dt IS NULL`


module.exports = {
    getJob: async(req, res) => {
        try {
            let { id } = req.query
            let containerQuery = ''
            if (id) containerQuery += ` AND tmj.uuid = '${id}'`
            let q = `
                SELECT 
                    tmj.uuid as job_id,
                    tmj.uuid,
                    tmj.job_no,
                    tmj.job_nm,
                    tmjt.job_type_nm,
                    tmjt.uuid as job_type_id,
                    tmp.uuid as pos_id,
                    tmp.pos_nm,
                    tml.uuid as line_id,
                    tml.line_nm,
                    tmm.machine_nm,
                    tmm.uuid as machine_id,
                    tmj.attachment,
                    tmj.created_by,
                    tmj.created_dt
                FROM ${table.tb_m_jobs} tmj
                JOIN ${table.tb_m_job_types} tmjt ON tmj.job_type_id = tmjt.job_type_id
                JOIN ${table.tb_m_pos} tmp ON tmp.pos_id = tmj.pos_id
                JOIN ${table.tb_m_machines} tmm ON tmm.machine_id = tmj.machine_id
                JOIN ${table.tb_m_lines} tml ON tml.line_id = tmm.line_id
                ${condDataNotDeleted}
                ${containerQuery}
            `
            const job = await queryCustom(q)
            response.success(res, 'Success to get job', job.rows)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get job')
        }
    },
    postJob: async(req, res) => {
        try {
            /* 
                pos_id,job_type_id,machine_id, job_nm, attachment, job_no, 
            */
            let idLast = await getLastIdData(table.tb_m_jobs, 'job_id') + 1
            req.body.job_id = idLast
            req.body.uuid = req.uuid()
            req.body.machine_id = await uuidToId(table.tb_m_machines, 'machine_id', req.body.machine_id)
            req.body.job_type_id = await uuidToId(table.tb_m_job_types, 'job_type_id', req.body.job_type_id)
            req.body.pos_id = await uuidToId(table.tb_m_pos, 'pos_id', req.body.pos_id)
            console.log(req.file.path);
            req.body.attachment = `./${req.file.path}`
            delete req.body.dest

            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_jobs, attrsUserInsert)
            response.success(res, 'Success to add job', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editJob: async(req, res) => {
        try {
            console.log(req.body);
            req.body.machine_id = await uuidToId(table.tb_m_machines, 'machine_id', req.body.machine_id)
            req.body.job_type_id = await uuidToId(table.tb_m_job_types, 'job_type_id', req.body.job_type_id)
            req.body.pos_id = await uuidToId(table.tb_m_pos, 'pos_id', req.body.pos_id)
            if (req.file) {
                const jobs = await queryGET(table.tb_m_jobs, `WHERE uuid = '${req.params.id}'`, ['attachment'])
                const prevDest = jobs[0].attachment
                fs.unlink(prevDest, function(err) {
                    console.log(err);
                })
                req.body.attachment = `./${req.file.path}`
            }
            delete req.body.dest
            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)

            const result = await queryPUT(table.tb_m_jobs, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to edit job', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteJob: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_jobs, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete job', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }
}