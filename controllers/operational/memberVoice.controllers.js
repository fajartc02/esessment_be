const table = require('../../config/table')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const getLastIdData = require('../../helpers/getLastIdData')
const { queryPOST, queryCustom, queryGET, queryPUT } = require('../../helpers/query')
const response = require('../../helpers/response')
const uuidToId = require('../../helpers/uuidToId')
const condDataNotDeleted = `WHERE trmv.deleted_dt IS NULL`


module.exports = {
    addMemberVoice: async(req, res) => {
        try {
            let {
                mv_date_finding,
                mv_location,
                mv_problem,
                mv_process_no,
                mv_category,
                mv_factor_id,
                mv_countermeasure,
                mv_evaluation,
                mv_plan_date,
                mv_actual_date,
                line_id,
                mv_pic_id
            } = req.body

            req.body.mv_id = await getLastIdData(table.tb_r_member_voice, 'mv_id') + 1
            req.body.uuid = await req.uuid();
            req.body.mv_pic_id = await uuidToId(table.tb_m_users, 'user_id', mv_pic_id);
            req.body.line_id = await uuidToId(table.tb_m_lines, 'line_id', line_id);
            req.body.mv_factor_id = await uuidToId(table.tb_m_factors, 'factor_id', mv_factor_id);
            let attrsUserCreated = await attrsUserInsertData(req, req.body)
            console.log(attrsUserCreated);
            await queryPOST(table.tb_r_member_voice, attrsUserCreated)
            response.success(res, 'Success to add Member Voice')
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to POST member voice')
        }
    },
    getMemberVoice: async(req, res) => {
        try {
            let { start_date, end_date, line_id, limit, currentPage } = req.query
            let containerQuery = ''
            if (line_id && line_id != -1 && line_id != 'null') containerQuery += ` AND tml.uuid = '${await uuidToId(table.tb_m_lines, 'line_id', line_id)}'`
            if (start_date && end_date) containerQuery += `AND mv_date_finding BETWEEN '${start_date}' AND '${end_date}'`;
            let qLimit = ``
            let qOffset = (limit != -1 && limit) && currentPage > 1 ? `OFFSET ${limit * (currentPage - 1)}` : ``
            if (limit != -1 && limit) qLimit = `LIMIT ${limit}`

            let q = `
            select 
                trmv.*,
                tml.line_nm 
            from tb_r_member_voice trmv 
            join tb_m_lines tml 
                on tml.line_id  = trmv.line_id
            ${condDataNotDeleted}
            ${containerQuery} ${qLimit} ${qOffset}`

            const queryMV = await queryCustom(q)
            const memberVoiceData = queryMV.rows
            console.log(memberVoiceData);
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to POST member voice')
        }
    }
}