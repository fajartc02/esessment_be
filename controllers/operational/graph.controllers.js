const table = require('../../config/table')
const { queryCustom, queryGET } = require('../../helpers/query')
const response = require('../../helpers/response')


module.exports = {
    graphFindingSTW: async(req, res) => {
        try {
            const q = `SELECT uuid as line_id, line_nm, line_snm FROM tb_m_lines`
            const rawLines = await queryCustom(q)
            let linesData = rawLines.rows

            let mapLinesCountFindings = await linesData.map(async line => {
                let findingMVProblem = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'MV' AND status_finding = 'problem'`, ['count(finding_id)'])
                let findingMVClosed = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'MV' AND status_finding = 'closed'`, ['count(finding_id)'])
                let findingMVRemain = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'MV' AND status_finding = 'remain'`, ['count(finding_id)'])

                let findingObsProblem = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'Obs' AND status_finding = 'problem'`, ['count(finding_id)'])
                let findingObsClosed = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'Obs' AND status_finding = 'closed'`, ['count(finding_id)'])
                let findingObsRemain = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'Obs' AND status_finding = 'remain'`, ['count(finding_id)'])

                let findingHProblem = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'H' AND status_finding = 'problem'`, ['count(finding_id)'])
                let findingHClosed = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'H' AND status_finding = 'closed'`, ['count(finding_id)'])
                let findingHRemain = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'H' AND status_finding = 'remain'`, ['count(finding_id)'])

                let findingFTProblem = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'FT' AND status_finding = 'problem'`, ['count(finding_id)'])
                let findingFTClosed = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'FT' AND status_finding = 'closed'`, ['count(finding_id)'])
                let findingFTRemain = await queryGET(table.v_finding_list, `WHERE line_id = '${line.line_id}' AND source_category = 'FT' AND status_finding = 'remain'`, ['count(finding_id)'])

                line.chartData = [{
                    name: 'Member Voice',
                    // Problem, Closed, Remain
                    data: [+findingMVProblem[0].count, +findingMVClosed[0].count, +findingMVRemain[0].count]
                }, {
                    name: 'Observation',
                    // Problem, Closed, Remain
                    data: [+findingObsProblem[0].count, +findingObsClosed[0].count, +findingObsRemain[0].count]
                }, {
                    name: 'Henkaten',
                    // Problem, Closed, Remain
                    data: [+findingHProblem[0].count, +findingHClosed[0].count, +findingHRemain[0].count]
                }, {
                    name: 'Fokus Tema',
                    // Problem, Closed, Remain
                    data: [+findingFTProblem[0].count, +findingFTClosed[0].count, +findingFTRemain[0].count]
                }]
                return line
            })
            let waitGraphData = await Promise.all(mapLinesCountFindings)
            console.log(waitGraphData);
            response.success(res, 'Success tp get graph finding STW', waitGraphData)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get graph finding STW')
        }
    }
}