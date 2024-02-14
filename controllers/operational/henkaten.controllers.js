const table = require('../../config/table')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const getLastIdData = require('../../helpers/getLastIdData')
const { queryPOST, queryCustom, queryGET, queryPUT } = require('../../helpers/query')
const response = require('../../helpers/response')
const uuidToId = require('../../helpers/uuidToId')
const condDataNotDeleted = `WHERE henkaten.deleted_dt IS NULL`


module.exports = {
    addHenkaten: async(req, res) => {
        try {
            let findingData = req.body.findings
            delete req.body.findings
            let henkatenObj = req.body
            let lasthenkatenId = await getLastIdData(table.tb_r_henkaten, 'henkaten_id') + 1
            henkatenObj.henkaten_id = await lasthenkatenId
            henkatenObj.uuid = req.uuid()
            henkatenObj.henkaten_pic = await uuidToId(table.tb_m_users, 'user_id', henkatenObj.henkaten_pic) ?? null
            henkatenObj.henkaten_line_id = await uuidToId(table.tb_m_lines, 'line_id', henkatenObj.henkaten_line_id) ?? null
            let attrsUserCreated = await attrsUserInsertData(req, henkatenObj)
            console.log(attrsUserCreated);
            let henkatenData = await queryPOST(table.tb_r_henkaten, attrsUserCreated)


            let lastFindingId = await getLastIdData(table.tb_r_findings, 'finding_id') + 1
            findingData.category_id = await uuidToId(table.tb_m_categories, 'category_id', findingData.category_id) ?? null
            findingData.cm_pic_id = await uuidToId(table.tb_m_users, 'user_id', findingData.cm_pic_id) ?? null
            findingData.factor_id = await uuidToId(table.tb_m_factors, 'factor_id', findingData.factor_id) ?? null
            findingData.line_id = await uuidToId(table.tb_m_lines, 'line_id', findingData.line_id) ?? null
            findingData.cm_result_factor_id = await uuidToId(table.tb_m_factors, 'factor_id', findingData.cm_result_factor_id) ?? null
            let objFinding = {
                finding_id: lastFindingId,
                uuid: req.uuid(),
                finding_henkaten_id: henkatenData.rows[0].henkaten_id,
                ...findingData
            }
            let attrsUserInsertFinding = await attrsUserInsertData(req, objFinding)
            await queryPOST(table.tb_r_findings, attrsUserInsertFinding)
            response.success(res, 'Success to POST Henkaten')
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to POST Henkaten')
        }
    },
    getHenkaten: async(req, res) => {
        try {
            let { start_date, end_date, line_id, limit, currentPage } = req.query
            let containerQuery = ''
            if (line_id && line_id != -1 && line_id != 'null') containerQuery += ` AND tml.line_id = '${await uuidToId(table.tb_m_lines, 'line_id', line_id)}'`
            if (start_date && end_date) containerQuery += `AND henkaten.created_dt BETWEEN '${start_date}' AND '${end_date}'`;
            let qLimit = ``
            let qOffset = (limit != -1 && limit) && currentPage > 1 ? `OFFSET ${limit * (currentPage - 1)}` : ``
            if (limit != -1 && limit) qLimit = `LIMIT ${limit}`

            let q = `
            select 
                henkaten.*,
                henkaten.uuid as henkaten_id,
                tmu.uuid as henkaten_pic,
                tmu.noreg || '-' || tmu.fullname as henkaten_pic_nm,
                tml.line_nm,
                tml.uuid as henkaten_line_id
            from tb_r_henkaten henkaten 
            join tb_m_lines tml 
                on tml.line_id  = henkaten.henkaten_line_id
            join tb_m_users tmu
                on tmu.user_id = henkaten.henkaten_pic
            ${condDataNotDeleted}
            ${containerQuery} ${qLimit} ${qOffset}`

            const queryhenkaten = await queryCustom(q)
            const HenkatenData = queryhenkaten.rows
            const henkatenFindingsData = HenkatenData.map(async henkaten => {
                henkaten.findings = await queryGET(table.v_finding_list, `WHERE finding_henkaten_id = '${henkaten.uuid}'`)
                return henkaten
            })
            const waithenkatenFindings = await Promise.all(henkatenFindingsData)
            let qCountTotal = `SELECT 
            count(henkaten.henkaten_id) as total_page
            from tb_r_henkaten henkaten 
            join tb_m_lines tml 
                on tml.line_id  = henkaten.henkaten_line_id
            join tb_m_users tmu
                on tmu.user_id = henkaten.henkaten_pic
        ${condDataNotDeleted}
        ${containerQuery}`
            let total_page = await queryCustom(qCountTotal)
            let totalPage = await total_page.rows[0].total_page
            if (HenkatenData.length > 0) {
                HenkatenData[0].total_page = +totalPage > 0 ? Math.ceil(totalPage / +limit) : 1
                HenkatenData[0].limit = +limit
            }
            response.success(res, 'Success to GET Henkaten', waithenkatenFindings)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to GET Henkaten')
        }
    }
}