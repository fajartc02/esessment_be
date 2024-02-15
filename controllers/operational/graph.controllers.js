const table = require('../../config/table')
const { queryCustom, queryGET } = require('../../helpers/query')
const response = require('../../helpers/response')


module.exports = {
    graphFindingSTW: async(req, res) => {
        try {
            let { start_date, end_date, line_id } = req.query
            let isLine = false;
            line_id && line_id != '' & line_id != null & line_id != 'null' ? isLine = true : isLine = false;

            const q = `SELECT uuid as line_id, line_nm, line_snm FROM tb_m_lines ${isLine ? `WHERE uuid = '${line_id}'` : ''}`

            const rawLines = await queryCustom(q)
            let linesData = rawLines.rows
            let months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
            let mapLineMonth = await months.map((month, i) => {
                
                return {
                    month: month,
                    idxMonth: i + 1,
                    ...linesData[0]
                }
            })
            
            isLine ? linesData = mapLineMonth : null
            
            let mapLinesCountFindings = await linesData.map(async line => {
                let findingMVProblem = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'MV' AND status_finding = 'problem' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingMVClosed = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'MV' AND status_finding = 'closed' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingMVRemain = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'MV' AND status_finding = 'remain' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])

                let findingObsProblem = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'Obs' AND status_finding = 'problem' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingObsClosed = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'Obs' AND status_finding = 'closed' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingObsRemain = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'Obs' AND status_finding = 'remain' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])

                let findingHProblem = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'H' AND status_finding = 'problem' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingHClosed = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'H' AND status_finding = 'closed' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingHRemain = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'H' AND status_finding = 'remain' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])

                let findingFTProblem = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'FT' AND status_finding = 'problem' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingFTClosed = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'FT' AND status_finding = 'closed' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingFTRemain = await queryGET(table.v_finding_list, `WHERE line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'FT' AND status_finding = 'remain' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                console.log(findingObsClosed);
                console.log(findingMVClosed);
                if (!isLine) {
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
                } else {
                    // console.log(findingMVProblem);
                    
                    line.chartData = [{
                        name: 'Member Voice',
                        // Problem, Closed, Remain
                        data: [+findingMVProblem[0]?.count ? +findingMVProblem[0].count : 0, +findingMVClosed[0]?.count ? +findingMVClosed[0]?.count : 0, +findingMVRemain[0]?.count ? +findingMVRemain[0]?.count : 0]
                    }, {
                        name: 'Observation',
                        // Problem, Closed, Remain
                        data: [+findingObsProblem[0]?.count ? +findingObsProblem[0].count: 0, +findingObsClosed[0]?.count ? +findingObsClosed[0]?.count : 0, +findingObsRemain[0]?.count ? +findingObsRemain[0]?.count : 0]
                    }, {
                        name: 'Henkaten',
                        // Problem, Closed, Remain
                        data: [+findingHProblem[0]?.count ? +findingHProblem[0].count: 0, +findingHClosed[0]?.count ? +findingHClosed[0]?.count : 0, +findingHRemain[0]?.count ? +findingHRemain[0]?.count : 0]
                    }, {
                        name: 'Fokus Tema',
                        // Problem, Closed, Remain
                        data: [+findingFTProblem[0]?.count ? +findingFTProblem[0].count: 0, +findingFTClosed[0]?.count ? +findingFTClosed[0]?.count : 0, +findingFTRemain[0]?.count ? +findingFTRemain[0]?.count : 0]
                    }]
                }
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