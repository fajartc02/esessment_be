const table = require("../../config/table");
const queryCondExacOpAnd = require("../../helpers/conditionsQuery");
const { queryCustom, queryGET } = require("../../helpers/query");
const response = require("../../helpers/response");
const moment = require('moment')
const condDataNotDeleted = `deleted_dt IS NULL`;
const logger = require("../../helpers/logger.js")

module.exports = {
    graphFinding4s: async (req, res) => {
        try
        {
            let { start_date, end_date, line_id, group_id } = req.query;
            if (!start_date)
            {
                start_date = moment().format('YYYY-MM-DD')
            }
            if (!end_date)
            {
                end_date = moment().format('YYYY-MM-DD')
            }

            let isLine = false;
            let isGroup = false;
            // end_date To fixing / handler from FE
            end_date = `${end_date}`.replace("/", "");
            line_id &&
                (line_id != "") & (line_id != null) & (line_id != "null") &&
                line_id != -1 &&
                line_id != "-1/"
                ? (isLine = true)
                : (isLine = false);
            group_id &&
                (group_id != "") & (group_id != null) & (group_id != "null") &&
                group_id != -1 &&
                group_id != "-1/"
                ? (isGroup = true)
                : (isGroup = false);
            const q = `SELECT uuid as line_id, line_nm, line_snm FROM ${table.tb_m_lines} WHERE ${condDataNotDeleted} ${isLine ? ` AND uuid = '${line_id}'` : ""
                } `;

            const rawLines = await queryCustom(q);
            let linesData = rawLines.rows;
            let months = [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
            ];

            let mapLineMonth = months.map((month, i) => {
                return {
                    month: month,
                    idxMonth: i + 1,
                    ...linesData[0],
                };
            });

            isLine ? (linesData = mapLineMonth) : null;

            let mapLinesCountFindings = await linesData.map(async (line) => {
                let findingProblem = await queryGET(
                    table.v_4s_finding_list,
                    `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id
                    }' AND status_finding = 'problem' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ""
                    } ${isLine
                        ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}`
                        : ""
                    } ${isLine
                        ? "GROUP BY EXTRACT('MONTH' FROM finding_date)"
                        : ""
                    }`,
                    [
                        `count(finding_id)::int${isLine
                            ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month"
                            : ""
                        }`,
                    ]
                );
                let findingClosed = await queryGET(
                    table.v_4s_finding_list,
                    `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id
                    }' AND status_finding = 'closed' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ""
                    } ${isLine
                        ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}`
                        : ""
                    } ${isLine
                        ? "GROUP BY EXTRACT('MONTH' FROM finding_date)"
                        : ""
                    }`,
                    [
                        `count(finding_id)::int${isLine
                            ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month"
                            : ""
                        }`,
                    ]
                );
                let findingRemain = await queryGET(
                    table.v_4s_finding_list,
                    `WHERE ${condDataNotDeleted} AND line_id = '${isLine ? line_id : line.line_id
                    }' AND status_finding = 'remain' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ""
                    } ${isLine
                        ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}`
                        : ""
                    } ${isLine
                        ? "GROUP BY EXTRACT('MONTH' FROM finding_date)"
                        : ""
                    }`,
                    [
                        `count(finding_id)::int${isLine
                            ? ",  EXTRACT('MONTH' FROM finding_date)::int AS month"
                            : ""
                        }`,
                    ]
                );

                if (!isLine)
                {
                    line.chartData = [
                        {
                            data: [
                                +findingProblem[0].count,
                                +findingClosed[0].count,
                                +findingRemain[0].count,
                            ],
                        },
                    ];
                } else
                {
                    line.chartData = [
                        {
                            data: [
                                +findingProblem[0]?.count ? +findingProblem[0].count : 0,
                                +findingClosed[0]?.count ? +findingClosed[0]?.count : 0,
                                +findingRemain[0]?.count ? +findingRemain[0]?.count : 0,
                            ],
                        },
                    ];
                }
                return line;
            });
            let waitGraphData = await Promise.all(mapLinesCountFindings);
            //console.log(waitGraphData);
            
            response.success(res, "Success tp get graph finding 4s", waitGraphData);
        } catch (error)
        {
            console.log(error);
            response.failed(res, "Error to get graph finding 4s");
        }
    },
    graphOverall4s: async (req, res) => {
        try
        {
            // Problem yang belum slesai terhadap close
            if (!req.start_date)
            {
                req.start_date = moment().format('YYYY-MM-DD')
            }
            if (!req.end_date)
            {
                req.end_date = moment().format('YYYY-MM-DD')
            }

            let conditions = queryCondExacOpAnd(req.query, "finding_date");
            let q = `SELECT 
                count(finding_id)::int as total,
                status_finding
            FROM ${table.v_4s_finding_list}
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
            for (let i = 0; i < dataMapPerc.length; i++)
            {
                let element = dataMapPerc[i];
                let findData = dataGraph.find((elem) => {
                    return elem.name == element.status_finding;
                });
                findData.data[0] = element.perc;
                findData.count = element.total;
            }
            console.log("findData");
            console.log(dataGraph);
            response.success(res, "Success to Summary graph 4s", dataGraph);
        } catch (error)
        {
            console.log('graphOverall4s', error)
            response.failed(res, "Error to Summary graph 4s");
        }
    },
};
