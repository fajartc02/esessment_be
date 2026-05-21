const table = require("../../config/table");
const queryCondExacOpAnd = require("../../helpers/conditionsQuery");
const { queryCustom, queryGET } = require("../../helpers/query");
const response = require("../../helpers/response");
const condDataNotDeleted = `deleted_dt IS NULL`;

module.exports = {
    graphFindingSTW: async (req, res) => {
        try {
            let { start_date, end_date, line_id, group_id } = req.query;
            let isLine = line_id && line_id != "" && line_id != "null" && line_id != -1 && line_id != "-1/";
            let isGroup = group_id && group_id != "" && group_id != "null" && group_id != -1 && group_id != "-1/";

            // end_date To fixing / handler from FE
            end_date = `${end_date}`.replace("/", "");

            const linesQuery = `SELECT uuid as line_id, line_nm, line_snm FROM tb_m_lines WHERE ${condDataNotDeleted} ${isLine ? ` AND uuid = '${line_id}'` : ""}`;
            const rawLines = await queryCustom(linesQuery);
            let linesData = rawLines.rows;

            let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

            // Single aggregate query for all findings
            let aggregateQuery = `
                SELECT 
                    ${isLine ? "EXTRACT('MONTH' FROM finding_date)::int" : "line_id"} as group_key,
                    source_category,
                    COUNT(finding_id) FILTER (WHERE status_finding = 'problem')::int as problem_count,
                    COUNT(finding_id) FILTER (WHERE status_finding = 'closed')::int as closed_count,
                    COUNT(finding_id) FILTER (WHERE status_finding = 'remain')::int as remain_count
                FROM v_finding_list
                WHERE ${condDataNotDeleted}
                AND finding_date BETWEEN '${start_date}' AND '${end_date}'
                ${isLine ? ` AND line_id = '${line_id}'` : ""}
                ${isGroup ? ` AND group_id = '${group_id}'` : ""}
                GROUP BY group_key, source_category
            `;

            const rawFindings = await queryCustom(aggregateQuery);
            const findingsData = rawFindings.rows;

            // Categories to report
            const categories = [
                { name: "Member Voice", key: "MV" },
                { name: "Observation", key: "Obs" },
                { name: "Henkaten", key: "H" },
                { name: "Fokus Tema", key: "FT" }
            ];

            let resultData = [];

            if (isLine) {
                // If isLine, result should be 12 months for that specific line
                resultData = months.map((month, i) => {
                    const monthIdx = i + 1;
                    const monthFindings = findingsData.filter(f => f.group_key === monthIdx);
                    
                    const chartData = categories.map(cat => {
                        const catData = monthFindings.find(f => f.source_category === cat.key);
                        return {
                            name: cat.name,
                            data: [
                                catData ? catData.problem_count : 0,
                                catData ? catData.closed_count : 0,
                                catData ? catData.remain_count : 0
                            ]
                        };
                    });

                    return {
                        month: month,
                        idxMonth: monthIdx,
                        ...linesData[0],
                        chartData: chartData
                    };
                });
            } else {
                // If not isLine, result should be for each line
                resultData = linesData.map(line => {
                    const lineFindings = findingsData.filter(f => f.group_key === line.line_id);
                    
                    const chartData = categories.map(cat => {
                        const catData = lineFindings.find(f => f.source_category === cat.key);
                        return {
                            name: cat.name,
                            data: [
                                catData ? catData.problem_count : 0,
                                catData ? catData.closed_count : 0,
                                catData ? catData.remain_count : 0
                            ]
                        };
                    });

                    return {
                        ...line,
                        chartData: chartData
                    };
                });
            }

            response.success(res, "Success to get graph finding STW", resultData);
        } catch (error) {
            console.error(error);
            response.failed(res, "Error to get graph finding STW");
        }
    },
  graphOverallSTW: async (req, res) => {
    try {
      // Problem yang belum slesai terhadap close
      let conditions = queryCondExacOpAnd(req.query, "finding_date");
      let q = `SELECT 
                ROUND(count(finding_id)::int) as total,
                status_finding
            FROM v_finding_list
            WHERE ${condDataNotDeleted}
            AND ${conditions}
            GROUP BY status_finding`;
      let data = await queryCustom(q);
      console.log(data.rows);
      let sum = data.rows.reduce((n, { total }) => n + total, 0);
      let dataMapPerc = await data.rows.map((item) => {
        item.perc = +((item.total / sum) * 100).toFixed(1);
        return item;
      });
      let dataGraph = [
        {
          name: "problem",
          data: [0],
          perc: 0,
        },
        {
          name: "closed",
          data: [0],
          perc: 0,
        },
        {
          name: "remain",
          data: [0],
          perc: 0,
        },
      ];
      for (let i = 0; i < dataMapPerc.length; i++) {
        let element = dataMapPerc[i];
        let findData = dataGraph.find((elem) => {
          return elem.name == element.status_finding;
        });
        findData.data[0] = element.perc;
        findData.count = element.total;
      }
      console.log("findData");
      console.log(dataGraph);
      response.success(res, "Success to Summary graph STW", dataGraph);
    } catch (error) {
      response.failed(res, "Error to Summary graph STW");
    }
  },
};