const table = require('../../config/table')
const queryCondExacOpAnd = require('../../helpers/conditionsQuery')
const { queryCustom, queryGET } = require('../../helpers/query')
const response = require('../../helpers/response')
const condDataNotDeleted = `deleted_dt IS NULL`


module.exports = {
        graphFindingSTW: async(req, res) => {
                try {
                    let { start_date, end_date, line_id, group_id } = req.query
                    let isLine = false;
                    let isGroup = false;
                    // end_date To fixing / handler from FE
                    end_date = `${end_date}`.replace('/', '')
                    line_id && line_id != '' & line_id != null & line_id != 'null' && line_id != -1 && line_id != '-1/' ? isLine = true : isLine = false;
                    group_id && group_id != '' & group_id != null & group_id != 'null' && group_id != -1 && group_id != '-1/' ? isGroup = true : isGroup = false;
                    const q = `SELECT uuid as line_id, line_nm, line_snm FROM tb_m_lines WHERE ${condDataNotDeleted} ${isLine ? ` AND uuid = '${line_id}'` : ''} `

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
                let findingMVProblem = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'MV' AND status_finding = 'problem' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingMVClosed = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'MV' AND status_finding = 'closed' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingMVRemain = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'MV' AND status_finding = 'remain' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])

                let findingObsProblem = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'Obs' AND status_finding = 'problem' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingObsClosed = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'Obs' AND status_finding = 'closed' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingObsRemain = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'Obs' AND status_finding = 'remain' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])

                let findingHProblem = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'H' AND status_finding = 'problem' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingHClosed = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'H' AND status_finding = 'closed' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingHRemain = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'H' AND status_finding = 'remain' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])

                let findingFTProblem = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'FT' AND status_finding = 'problem' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingFTClosed = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'FT' AND status_finding = 'closed' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])
                let findingFTRemain = await queryGET(table.v_finding_list, `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id}' AND source_category = 'FT' AND status_finding = 'remain' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ''} ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ''} ${isLine ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)" : ''}`, [`count(finding_id)::int${isLine ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month, source_category" : ''}`])

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
    },
    graphOverallSTW: async (req, res) => {
        try {
            // Problem yang belum slesai terhadap close
            let conditions = queryCondExacOpAnd(req.query, 'finding_date')
            let q = `SELECT 
                count(finding_id)::int as total,
                status_finding
            FROM v_finding_list
            WHERE ${condDataNotDeleted}
            AND ${conditions}
            GROUP BY status_finding`
            let data = await queryCustom(q);
            console.log(data.rows);
            let sum = data.rows.reduce((n, {total}) => n + total, 0);
            let dataMapPerc = await data.rows.map(item => {
                item.perc = +((item.total / sum) * 100).toFixed(1)
                return item
            })
            let dataGraph = [{
                name: 'problem',
                data: [0],
                perc: 0
            },{
                name: 'closed',
                data: [0],
                perc: 0
            },{
                name: 'remain',
                data: [0],
                perc: 0
            }]
            for (let i = 0; i < dataMapPerc.length; i++) {
                let element = dataMapPerc[i];
                let findData = dataGraph.find(elem => {return elem.name == element.status_finding})
                findData.data[0] = element.perc
                findData.perc = element.total
            }
            console.log('findData');
            console.log(dataGraph);

            response.success(res, 'Success to Summary graph STW', dataGraph)
        } catch (error) {
            response.failed(res, 'Error to Summary graph STW')
        }
    }
}