const table = require('../../config/table')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const getLastIdData = require('../../helpers/getLastIdData')
const { queryPOST, queryCustom, queryGET, queryPUT } = require('../../helpers/query')
const response = require('../../helpers/response')
const uuidToId = require('../../helpers/uuidToId')
const condDataNotDeleted = `WHERE trft.deleted_dt IS NULL`


module.exports = {
    addFocusThema: async(req, res) => {
        try {
            let findingData = req.body.findings
            delete req.body.findings
            let ftObj = req.body
            let lastFtId = await getLastIdData(table.tb_r_focus_theme, 'ft_id') + 1
            ftObj.ft_id = await lastFtId
            ftObj.uuid = req.uuid()
            ftObj.ft_line_id = await uuidToId(table.tb_m_lines, 'line_id', ftObj.ft_line_id) ?? null
            let attrsUserCreated = await attrsUserInsertData(req, ftObj)
            let ftData = await queryPOST(table.tb_r_focus_theme, attrsUserCreated)
            let lastFindingId = await getLastIdData(table.tb_r_findings, 'finding_id') + 1
            findingData.category_id = await uuidToId(table.tb_m_categories, 'category_id', findingData.category_id) ?? null
            findingData.cm_pic_id = await uuidToId(table.tb_m_users, 'user_id', findingData.cm_pic_id) ?? null
            findingData.factor_id = await uuidToId(table.tb_m_factors, 'factor_id', findingData.factor_id) ?? null
            findingData.line_id = await uuidToId(table.tb_m_lines, 'line_id', findingData.line_id) ?? null
            findingData.cm_result_factor_id = await uuidToId(table.tb_m_factors, 'factor_id', findingData.cm_result_factor_id) ?? null
            let objFinding = {
                finding_id: lastFindingId,
                uuid: req.uuid(),
                finding_ft_id: ftData.rows[0].ft_id,
                ...findingData
            }
            let attrsUserInsertFinding = await attrsUserInsertData(req, objFinding)
            await queryPOST(table.tb_r_findings, attrsUserInsertFinding)
            response.success(res, 'Success to POST Focus Thema')
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to POST Focus Thema')
        }
    },
    getFocusThema: async(req, res) => {
        try {
            let { start_date, end_date, line_id, limit, currentPage } = req.query
            let containerQuery = ''
            if (line_id && line_id != -1 && line_id != 'null') containerQuery += ` AND tml.line_id = '${await uuidToId(table.tb_m_lines, 'line_id', line_id)}'`
            if (start_date && end_date) containerQuery += `AND trft.created_dt BETWEEN '${start_date}' AND '${end_date}'`;
            let qLimit = ``
            let qOffset = (limit != -1 && limit) && currentPage > 1 ? `OFFSET ${limit * (currentPage - 1)}` : ``
            if (limit != -1 && limit) qLimit = `LIMIT ${limit}`

            let q = `
            select 
                trft.*,
                trft.uuid as ft_id,
                tml.line_nm,
                tml.uuid as ft_line_id 
            from tb_r_focus_theme trft 
            join tb_m_lines tml 
                on tml.line_id  = trft.ft_line_id
            ${condDataNotDeleted}
            ${containerQuery} ${qLimit} ${qOffset}`

            const queryFT = await queryCustom(q)
            const FocusThemaData = queryFT.rows
            const ftFindingsData = FocusThemaData.map(async ft => {
                ft.findings = await queryGET(table.v_finding_list, `WHERE finding_ft_id = '${ft.uuid}'`)
                return ft
            })
            const waitFtFindings = await Promise.all(ftFindingsData)
            let qCountTotal = `SELECT 
            count(trft.ft_id) as total_page
            from tb_r_focus_theme trft 
            join tb_m_lines tml 
                on tml.line_id  = trft.ft_line_id
        ${condDataNotDeleted}
        ${containerQuery}`
            let total_page = await queryCustom(qCountTotal)
            let totalPage = await total_page.rows[0].total_page
            if (FocusThemaData.length > 0) {
                FocusThemaData[0].total_page = +totalPage > 0 ? Math.ceil(totalPage / +limit) : 1
                FocusThemaData[0].limit = +limit
            }
            response.success(res, 'Success to GET Focus Thema', waitFtFindings)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to GET Focus Thema')
        }
    }
}