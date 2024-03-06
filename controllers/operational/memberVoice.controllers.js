const table = require('../../config/table')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const queryCondExacOpAnd = require('../../helpers/conditionsQuery')
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
            let mvObj = {
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
            }

            mvObj.mv_id = await getLastIdData(table.tb_r_member_voice, 'mv_id') + 1
            mvObj.uuid = await req.uuid();
            mvObj.mv_pic_id = await uuidToId(table.tb_m_users, 'user_id', mv_pic_id);
            mvObj.line_id = await uuidToId(table.tb_m_lines, 'line_id', line_id);
            mvObj.mv_factor_id = await uuidToId(table.tb_m_factors, 'factor_id', mv_factor_id);
            let attrsUserCreated = await attrsUserInsertData(req, mvObj)
            console.log(req.body.findings);
            let mvData = await queryPOST(table.tb_r_member_voice, attrsUserCreated)
                // INSERT TO TB_R_FINDINGS
            let lastFindingId = await getLastIdData(table.tb_r_findings, 'finding_id') + 1
            req.body.findings.category_id = req.body.findings.category_id != '' && req.body.findings.category_id ? await uuidToId(table.tb_m_categories, 'category_id', req.body.findings.category_id) ?? null : null
            req.body.findings.cm_pic_id = await uuidToId(table.tb_m_users, 'user_id', req.body.findings.cm_pic_id) ?? null
            req.body.findings.factor_id = await uuidToId(table.tb_m_factors, 'factor_id', req.body.findings.factor_id) ?? null
            req.body.findings.line_id = await uuidToId(table.tb_m_lines, 'line_id', req.body.findings.line_id) ?? null
            req.body.findings.cm_result_factor_id = await uuidToId(table.tb_m_factors, 'factor_id', req.body.findings.cm_result_factor_id) ?? null
            
            let dataFinding = {
                uuid: req.uuid(),
                finding_id: lastFindingId,
                finding_mv_id: mvData.rows[0].mv_id,
                ...req.body.findings
            }
            console.log(dataFinding);
            let attrsUserInsertFinding = await attrsUserInsertData(req, dataFinding)
            await queryPOST(table.tb_r_findings, attrsUserInsertFinding)
            response.success(res, 'Success to POST Member Voice')
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to POST member voice')
        }
    },
    getMemberVoice: async(req, res) => {
        try {
            let { start_date, end_date, line_id, limit, currentPage } = req.query
            req.query['tml.line_id'] = line_id != -1 && line_id ? `${await uuidToId(table.tb_m_lines, 'line_id', line_id)}` : null
            delete req.query.line_id
            let conditions = ' AND ' + queryCondExacOpAnd(req.query, 'trmv.created_dt')
            let qLimit = ``
            let qOffset = (limit != -1 && limit) && currentPage > 1 ? `OFFSET ${limit * (currentPage - 1)}` : ``
            if (limit != -1 && limit) qLimit = `LIMIT ${limit}`

            let q = `
            select 
                trmv.*,
                trmv.uuid as mv_id,
                tmfac.uuid as mv_factor_id,
                tmu.uuid as mv_pic_id,
                tmu.noreg || '-' || tmu.fullname as mv_pic_nm,
                date_part('week'::text, trmv.mv_plan_date) AS w_mv_plan_date,
                date_part('week'::text, trmv.mv_actual_date) AS w_mv_actual_date,
                tml.line_nm,
                tml.uuid as line_id,
                CASE
                    WHEN trmv.mv_plan_date < CURRENT_DATE AND trmv.mv_actual_date IS NULL THEN 'DELAY'::text
                    WHEN trmv.mv_actual_date IS NULL THEN 'PROGRESS'::text
                    WHEN trmv.mv_actual_date IS NOT NULL THEN 'DONE'::text
                END AS status_check 
            from tb_r_member_voice trmv 
            join tb_m_lines tml 
                on tml.line_id  = trmv.line_id
            join tb_m_users tmu
                on tmu.user_id = trmv.mv_pic_id
            join tb_m_factors tmfac
                on tmfac.factor_id = trmv.mv_factor_id
            ${condDataNotDeleted}
            ${conditions} ${qLimit} ${qOffset}`

            const queryMV = await queryCustom(q)
            const memberVoiceData = queryMV.rows
            const mvFindingsData = memberVoiceData.map(async mv => {
                mv.findings = await queryGET(table.v_finding_list, `WHERE finding_mv_id = '${mv.uuid}'`)
                return mv
            })
            const waitMvFindings = await Promise.all(mvFindingsData)
            
            let qCountTotal = `SELECT 
            count(trmv.mv_id) as total_page
            from tb_r_member_voice trmv 
            join tb_m_lines tml 
                on tml.line_id  = trmv.line_id
            join tb_m_users tmu
                on tmu.user_id = trmv.mv_pic_id
        ${condDataNotDeleted}
        ${conditions}`
            let total_page = await queryCustom(qCountTotal)
            let totalPage = await total_page.rows[0].total_page
            if (waitMvFindings.length > 0) {
                waitMvFindings[0].total_page = +totalPage > 0 ? Math.ceil(totalPage / +limit) : 1
                waitMvFindings[0].limit = +limit
            }
            response.success(res, 'Success to GET member voice', waitMvFindings)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to GET member voice')
        }
    },
    editMemberVoice: async(req, res) => {
        try {
            let findingsData = {
                ...req.body.findings,
                line_id: await uuidToId(table.tb_m_lines, 'line_id', req.body.findings.line_id),
                category_id: req.body.findings.category_id != '' && req.body.findings.category_id ? await uuidToId(table.tb_m_categories, 'category_id', req.body.findings.category_id) : null,
                factor_id: await uuidToId(table.tb_m_factors, 'factor_id', req.body.findings.factor_id),
                cm_pic_id: await uuidToId(table.tb_m_users, 'user_id', req.body.findings.cm_pic_id),
                cm_result_factor_id: await uuidToId(table.tb_m_factors, 'factor_id', req.body.findings.cm_result_factor_id),
            }

            delete req.body.findings
            
            let mvData = {
                ...req.body,
                line_id: await uuidToId(table.tb_m_lines, 'line_id', req.body.line_id),
                mv_factor_id: await uuidToId(table.tb_m_factors, 'factor_id', req.body.mv_factor_id),
                mv_pic_id: await uuidToId(table.tb_m_users, 'user_id', req.body.mv_pic_id)
            }
            let attrsUpdateUserFinding = await attrsUserUpdateData(req, findingsData)
            let attrsUpdateUserMv = await attrsUserUpdateData(req, mvData)
            let mv_id = await uuidToId(table.tb_r_member_voice, 'mv_id', req.params.id)
            
            await queryPUT(table.tb_r_findings, attrsUpdateUserFinding, `WHERE finding_mv_id = '${mv_id}'`)
            await queryPUT(table.tb_r_member_voice, attrsUpdateUserMv, `WHERE mv_id = '${mv_id}'`)
            response.success(res, 'Success to EDIT Member Voice')
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to EDIT member voice')
        }
    },
    deleteMemberVoice: async(req, res) => {
        // console.log(req.params);
        try {
            let mv_id = await uuidToId(table.tb_r_member_voice, 'mv_id', req.params.id)
            let obj = {
                deleted_dt: "CURRENT_TIMESTAMP",
                deleted_by: req.user.fullname
            }
            await queryPUT(table.tb_r_findings, obj, `WHERE finding_mv_id = '${mv_id}'`)
            await queryPUT(table.tb_r_member_voice, obj, `WHERE mv_id = '${mv_id}'`)
            response.success(res, 'Success to DELETE Member Voice')
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to DELETE member voice')
        }
    }
}