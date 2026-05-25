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
            const q = `
                SELECT 
                    uuid as line_id, 
                    case 
                        when line_nm like '%Line%' then 
                            'Assy Line - ' || line_nm 
                        else line_nm 
                    end as line_nm, 
                    line_snm 
                FROM 
                    ${table.tb_m_lines} 
                WHERE 
                    ${condDataNotDeleted} 
                    ${isLine ? ` AND uuid = '${line_id}'` : ""} 
                `;

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
                    }' AND finding_date BETWEEN '${start_date}' AND '${end_date}' ${isGroup ? ` AND group_id = '${group_id}'` : ""
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
            if (!req.query.start_date)
            {
                req.query.start_date = moment().format('YYYY-MM-DD')
            }
            if (!req.query.end_date)
            {
                req.query.end_date = moment().format('YYYY-MM-DD')
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
    graphHistoricalTime4s: async (req, res) => {
        try {
            let { line_id, group_id, year } = req.query;
            if (!year) {
                year = new Date().getFullYear();
            }

            let isLine = false;
            let isGroup = false;

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

            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (isLine && !uuidRegex.test(line_id)) {
                isLine = false;
            }
            if (isGroup && !uuidRegex.test(group_id)) {
                isGroup = false;
            }

            // Initialize 12-month arrays (index 0 = Jan, index 11 = Dec)
            const initArray = () => Array(12).fill(0);

            const sumOfTimeLine = {
                standard: initArray(),
                actual: initArray(),
                cm: initArray()
            };
            const sumOfTimeCol = {
                daily: initArray(),
                weekly: initArray(),
                monthly: initArray()
            };

            const countOfKanbanLine = {
                total: initArray()
            };
            const countOfKanbanCol = {
                daily: initArray(),
                weekly: initArray(),
                monthly: initArray()
            };

            const totalItemCheckLine = {
                total: initArray()
            };
            const totalItemCheckCol = {
                daily: initArray(),
                weekly: initArray(),
                monthly: initArray()
            };

            // 1. Sum of Standard & Actual Time (Line)
            const qTimeLine = `
                SELECT 
                    EXTRACT(MONTH FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int AS month,
                    SUM(COALESCE(trsic.standart_time, 0))::int AS total_standard_time,
                    SUM(COALESCE(trsic.actual_time, 0))::int AS total_actual_time
                FROM 
                    ${table.tb_r_4s_schedule_item_check_kanbans} trsic
                    JOIN ${table.tb_r_4s_main_schedules} trmsc ON trsic.main_schedule_id = trmsc.main_schedule_id
                    JOIN ${table.tb_m_lines} tml ON trmsc.line_id = tml.line_id
                    LEFT JOIN ${table.tb_m_groups} tmg ON trmsc.group_id = tmg.group_id
                WHERE 
                    trsic.deleted_dt IS NULL 
                    AND trmsc.deleted_dt IS NULL
                    AND EXTRACT(YEAR FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int = ${year}
                    ${isLine ? `AND tml.uuid = '${line_id}'` : ''}
                    ${isGroup ? `AND tmg.uuid = '${group_id}'` : ''}
                GROUP BY 
                    month
                ORDER BY 
                    month
            `;
            const rTimeLine = await queryCustom(qTimeLine);
            rTimeLine.rows.forEach(row => {
                const idx = row.month - 1;
                if (idx >= 0 && idx < 12) {
                    sumOfTimeLine.standard[idx] = row.total_standard_time;
                    sumOfTimeLine.actual[idx] = row.total_actual_time;
                }
            });

            // 2. Sum of Countermeasure Time (Line)
            const qCmTime = `
                SELECT 
                    EXTRACT(MONTH FROM COALESCE(trf.finding_date, trf.created_dt::date))::int AS month,
                    SUM(COALESCE(trf.time_cm, 0))::int AS total_cm_time
                FROM 
                    ${table.tb_r_4s_findings} trf
                    JOIN ${table.tb_m_lines} tml ON trf.line_id = tml.line_id
                    LEFT JOIN ${table.tb_m_groups} tmg ON trf.group_id = tmg.group_id
                WHERE 
                    trf.deleted_dt IS NULL
                    AND EXTRACT(YEAR FROM COALESCE(trf.finding_date, trf.created_dt::date))::int = ${year}
                    ${isLine ? `AND tml.uuid = '${line_id}'` : ''}
                    ${isGroup ? `AND tmg.uuid = '${group_id}'` : ''}
                GROUP BY 
                    month
                ORDER BY 
                    month
            `;
            const rCmTime = await queryCustom(qCmTime);
            rCmTime.rows.forEach(row => {
                const idx = row.month - 1;
                if (idx >= 0 && idx < 12) {
                    sumOfTimeLine.cm[idx] = row.total_cm_time;
                }
            });

            // 3. Actual Time by Frequency (Column)
            const qTimeCol = `
                SELECT 
                    EXTRACT(MONTH FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int AS month,
                    LOWER(tmf.freq_nm) AS freq_nm,
                    SUM(COALESCE(trsic.actual_time, 0))::int AS total_actual_time
                FROM 
                    ${table.tb_r_4s_schedule_item_check_kanbans} trsic
                    JOIN ${table.tb_r_4s_main_schedules} trmsc ON trsic.main_schedule_id = trmsc.main_schedule_id
                    JOIN ${table.tb_m_lines} tml ON trmsc.line_id = tml.line_id
                    LEFT JOIN ${table.tb_m_groups} tmg ON trmsc.group_id = tmg.group_id
                    JOIN ${table.tb_m_4s_item_check_kanbans} tmick ON trsic.item_check_kanban_id = tmick.item_check_kanban_id
                    JOIN ${table.tb_m_kanbans} tmk ON tmick.kanban_id = tmk.kanban_id
                    JOIN ${table.tb_m_freqs} tmf ON tmk.freq_id = tmf.freq_id
                WHERE 
                    trsic.deleted_dt IS NULL 
                    AND trmsc.deleted_dt IS NULL
                    AND EXTRACT(YEAR FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int = ${year}
                    ${isLine ? `AND tml.uuid = '${line_id}'` : ''}
                    ${isGroup ? `AND tmg.uuid = '${group_id}'` : ''}
                GROUP BY 
                    month, LOWER(tmf.freq_nm)
                ORDER BY 
                    month
            `;
            const rTimeCol = await queryCustom(qTimeCol);
            rTimeCol.rows.forEach(row => {
                const idx = row.month - 1;
                if (idx >= 0 && idx < 12) {
                    const freqNm = (row.freq_nm || '').toLowerCase();
                    if (freqNm.includes('day')) sumOfTimeCol.daily[idx] += row.total_actual_time;
                    else if (freqNm.includes('week')) sumOfTimeCol.weekly[idx] += row.total_actual_time;
                    else sumOfTimeCol.monthly[idx] += row.total_actual_time;
                }
            });

            // 4. Count of Kanban (Line)
            const qKanbanLine = `
                SELECT 
                    EXTRACT(MONTH FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int AS month,
                    COUNT(DISTINCT tmick.kanban_id)::int AS total_kanban
                FROM 
                    ${table.tb_r_4s_schedule_item_check_kanbans} trsic
                    JOIN ${table.tb_r_4s_main_schedules} trmsc ON trsic.main_schedule_id = trmsc.main_schedule_id
                    JOIN ${table.tb_m_lines} tml ON trmsc.line_id = tml.line_id
                    LEFT JOIN ${table.tb_m_groups} tmg ON trmsc.group_id = tmg.group_id
                    JOIN ${table.tb_m_4s_item_check_kanbans} tmick ON trsic.item_check_kanban_id = tmick.item_check_kanban_id
                WHERE 
                    trsic.deleted_dt IS NULL 
                    AND trmsc.deleted_dt IS NULL
                    AND EXTRACT(YEAR FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int = ${year}
                    ${isLine ? `AND tml.uuid = '${line_id}'` : ''}
                    ${isGroup ? `AND tmg.uuid = '${group_id}'` : ''}
                GROUP BY 
                    month
                ORDER BY 
                    month
            `;
            const rKanbanLine = await queryCustom(qKanbanLine);
            rKanbanLine.rows.forEach(row => {
                const idx = row.month - 1;
                if (idx >= 0 && idx < 12) {
                    countOfKanbanLine.total[idx] = row.total_kanban;
                }
            });

            // 5. Count of Kanban by Frequency (Column)
            const qKanbanCol = `
                SELECT 
                    EXTRACT(MONTH FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int AS month,
                    LOWER(tmf.freq_nm) AS freq_nm,
                    COUNT(DISTINCT tmick.kanban_id)::int AS total_kanban
                FROM 
                    ${table.tb_r_4s_schedule_item_check_kanbans} trsic
                    JOIN ${table.tb_r_4s_main_schedules} trmsc ON trsic.main_schedule_id = trmsc.main_schedule_id
                    JOIN ${table.tb_m_lines} tml ON trmsc.line_id = tml.line_id
                    LEFT JOIN ${table.tb_m_groups} tmg ON trmsc.group_id = tmg.group_id
                    JOIN ${table.tb_m_4s_item_check_kanbans} tmick ON trsic.item_check_kanban_id = tmick.item_check_kanban_id
                    JOIN ${table.tb_m_kanbans} tmk ON tmick.kanban_id = tmk.kanban_id
                    JOIN ${table.tb_m_freqs} tmf ON tmk.freq_id = tmf.freq_id
                WHERE 
                    trsic.deleted_dt IS NULL 
                    AND trmsc.deleted_dt IS NULL
                    AND EXTRACT(YEAR FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int = ${year}
                    ${isLine ? `AND tml.uuid = '${line_id}'` : ''}
                    ${isGroup ? `AND tmg.uuid = '${group_id}'` : ''}
                GROUP BY 
                    month, LOWER(tmf.freq_nm)
                ORDER BY 
                    month
            `;
            const rKanbanCol = await queryCustom(qKanbanCol);
            rKanbanCol.rows.forEach(row => {
                const idx = row.month - 1;
                if (idx >= 0 && idx < 12) {
                    const freqNm = (row.freq_nm || '').toLowerCase();
                    if (freqNm.includes('day')) countOfKanbanCol.daily[idx] += row.total_kanban;
                    else if (freqNm.includes('week')) countOfKanbanCol.weekly[idx] += row.total_kanban;
                    else countOfKanbanCol.monthly[idx] += row.total_kanban;
                }
            });

            // 6. Total Item Checks (Line)
            const qItemLine = `
                SELECT 
                    EXTRACT(MONTH FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int AS month,
                    COUNT(trsic.schedule_item_check_kanban_id)::int AS total_checks
                FROM 
                    ${table.tb_r_4s_schedule_item_check_kanbans} trsic
                    JOIN ${table.tb_r_4s_main_schedules} trmsc ON trsic.main_schedule_id = trmsc.main_schedule_id
                    JOIN ${table.tb_m_lines} tml ON trmsc.line_id = tml.line_id
                    LEFT JOIN ${table.tb_m_groups} tmg ON trmsc.group_id = tmg.group_id
                WHERE 
                    trsic.deleted_dt IS NULL 
                    AND trmsc.deleted_dt IS NULL
                    AND EXTRACT(YEAR FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int = ${year}
                    ${isLine ? `AND tml.uuid = '${line_id}'` : ''}
                    ${isGroup ? `AND tmg.uuid = '${group_id}'` : ''}
                GROUP BY 
                    month
                ORDER BY 
                    month
            `;
            const rItemLine = await queryCustom(qItemLine);
            rItemLine.rows.forEach(row => {
                const idx = row.month - 1;
                if (idx >= 0 && idx < 12) {
                    totalItemCheckLine.total[idx] = row.total_checks;
                }
            });

            // 7. Total Item Checks by Frequency (Column)
            const qItemCol = `
                SELECT 
                    EXTRACT(MONTH FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int AS month,
                    LOWER(tmf.freq_nm) AS freq_nm,
                    COUNT(trsic.schedule_item_check_kanban_id)::int AS total_checks
                FROM 
                    ${table.tb_r_4s_schedule_item_check_kanbans} trsic
                    JOIN ${table.tb_r_4s_main_schedules} trmsc ON trsic.main_schedule_id = trmsc.main_schedule_id
                    JOIN ${table.tb_m_lines} tml ON trmsc.line_id = tml.line_id
                    LEFT JOIN ${table.tb_m_groups} tmg ON trmsc.group_id = tmg.group_id
                    JOIN ${table.tb_m_4s_item_check_kanbans} tmick ON trsic.item_check_kanban_id = tmick.item_check_kanban_id
                    JOIN ${table.tb_m_kanbans} tmk ON tmick.kanban_id = tmk.kanban_id
                    JOIN ${table.tb_m_freqs} tmf ON tmk.freq_id = tmf.freq_id
                WHERE 
                    trsic.deleted_dt IS NULL 
                    AND trmsc.deleted_dt IS NULL
                    AND EXTRACT(YEAR FROM COALESCE(trsic.checked_date, trsic.created_dt::date))::int = ${year}
                    ${isLine ? `AND tml.uuid = '${line_id}'` : ''}
                    ${isGroup ? `AND tmg.uuid = '${group_id}'` : ''}
                GROUP BY 
                    month, LOWER(tmf.freq_nm)
                ORDER BY 
                    month
            `;
            const rItemCol = await queryCustom(qItemCol);
            rItemCol.rows.forEach(row => {
                const idx = row.month - 1;
                if (idx >= 0 && idx < 12) {
                    const freqNm = (row.freq_nm || '').toLowerCase();
                    if (freqNm.includes('day')) totalItemCheckCol.daily[idx] += row.total_checks;
                    else if (freqNm.includes('week')) totalItemCheckCol.weekly[idx] += row.total_checks;
                    else totalItemCheckCol.monthly[idx] += row.total_checks;
                }
            });

            const payload = {
                sum_of_time: {
                    line: [
                        { name: "Standard Time", data: sumOfTimeLine.standard },
                        { name: "Actual Time", data: sumOfTimeLine.actual },
                        { name: "Countermeasure Time", data: sumOfTimeLine.cm }
                    ],
                    column: [
                        { name: "Daily", data: sumOfTimeCol.daily },
                        { name: "Weekly", data: sumOfTimeCol.weekly },
                        { name: "Monthly", data: sumOfTimeCol.monthly }
                    ]
                },
                count_of_kanban: {
                    line: [
                        { name: "Total Kanban Checked", data: countOfKanbanLine.total }
                    ],
                    column: [
                        { name: "Daily", data: countOfKanbanCol.daily },
                        { name: "Weekly", data: countOfKanbanCol.weekly },
                        { name: "Monthly", data: countOfKanbanCol.monthly }
                    ]
                },
                total_item_check: {
                    line: [
                        { name: "Total Item Checked", data: totalItemCheckLine.total }
                    ],
                    column: [
                        { name: "Daily", data: totalItemCheckCol.daily },
                        { name: "Weekly", data: totalItemCheckCol.weekly },
                        { name: "Monthly", data: totalItemCheckCol.monthly }
                    ]
                }
            };

            response.success(res, "Success to get historical 4s time graphs", payload);
        } catch (error) {
            console.log('graphHistoricalTime4s', error);
            response.failed(res, "Error to get historical 4s time graphs");
        }
    },
};
