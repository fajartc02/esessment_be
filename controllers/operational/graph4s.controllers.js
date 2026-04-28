const table = require("../../config/table");
const queryCondExacOpAnd = require("../../helpers/conditionsQuery");
const { queryCustom, queryGET } = require("../../helpers/query");
const response = require("../../helpers/response");
const moment = require('moment')
const condDataNotDeleted = `deleted_dt IS NULL`;
const logger = require("../../helpers/logger.js")

module.exports = {
    graphFinding4s: async (req, res) => {
        try {

            let { start_date, end_date, line_id, group_id } = req.query;

            // =========================
            // ✅ DEFAULT DATE
            // =========================
            if (!start_date) start_date = moment().format('YYYY-MM-DD');
            if (!end_date) end_date = moment().format('YYYY-MM-DD');

            // =========================
            // ✅ VALIDASI DATE
            // =========================
            const isValidDate = (d) => !isNaN(Date.parse(d));

            if (!isValidDate(start_date) || !isValidDate(end_date)) {
            return response.failed(res, "Invalid date format");
            }

            // =========================
            // ✅ VALIDASI UUID (SUPER STRICT)
            // =========================
            const uuidRegex = /^[0-9a-fA-F-]{36}$/;

            if (line_id && !uuidRegex.test(line_id)) {
            return response.failed(res, "Invalid line_id");
            }

            if (group_id && !uuidRegex.test(group_id)) {
            return response.failed(res, "Invalid group_id");
            }

            // =========================
            // ✅ FLAG
            // =========================
            let isLine = !!line_id;
            let isGroup = !!group_id;

            // =========================
            // ✅ QUERY LINE (AMAN)
            // =========================
            const q = `
            SELECT 
                uuid as line_id, 
                case 
                when line_nm like '%Line%' then 
                    'Assy Line - ' || line_nm 
                else line_nm 
                end as line_nm, 
                line_snm 
            FROM ${table.tb_m_lines}
            WHERE ${condDataNotDeleted}
            ${isLine ? ` AND uuid = '${line_id}'` : ""}
            `;

            const rawLines = await queryCustom(q);
            let linesData = rawLines.rows;

            // =========================
            // ✅ MONTH SETUP
            // =========================
            let months = [
            "January","February","March","April","May","June",
            "July","August","September","October","November","December"
            ];

            let mapLineMonth = months.map((month, i) => ({
            month,
            idxMonth: i + 1,
            ...linesData[0],
            }));

            if (isLine) linesData = mapLineMonth;

            // =========================
            // ✅ FUNCTION BUILDER (ANTI DUPLIKASI)
            // =========================
            const buildWhere = (line, status) => {
            let where = `
                WHERE ${condDataNotDeleted}
                AND line_id = '${isLine ? line_id : line.line_id}'
                AND status_finding = '${status}'
                AND finding_date BETWEEN '${start_date}' AND '${end_date}'
            `;

            if (isGroup) {
                where += ` AND group_id = '${group_id}'`;
            }

            if (isLine) {
                where += ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}`;
                where += ` GROUP BY EXTRACT('MONTH' FROM finding_date)`;
            }

            return where;
            };

            // =========================
            // ✅ LOOP QUERY
            // =========================
            let mapLinesCountFindings = await Promise.all(
            linesData.map(async (line) => {

                let findingProblem = await queryGET(
                table.v_4s_finding_list,
                buildWhere(line, 'problem'),
                [`count(finding_id)::int${isLine ? ", EXTRACT('MONTH' FROM finding_date)::int AS month" : ""}`]
                );

                let findingClosed = await queryGET(
                table.v_4s_finding_list,
                buildWhere(line, 'closed'),
                [`count(finding_id)::int${isLine ? ", EXTRACT('MONTH' FROM finding_date)::int AS month" : ""}`]
                );

                let findingRemain = await queryGET(
                table.v_4s_finding_list,
                buildWhere(line, 'remain'),
                [`count(finding_id)::int${isLine ? ", EXTRACT('MONTH' FROM finding_date)::int AS month" : ""}`]
                );

                line.chartData = [{
                data: [
                    +findingProblem[0]?.count || 0,
                    +findingClosed[0]?.count || 0,
                    +findingRemain[0]?.count || 0,
                ],
                }];

                return line;
            })
            );

            response.success(res, "Success to get graph finding 4s", mapLinesCountFindings);

        } catch (error) {
            console.log('graphFinding4s error:', error);
            response.failed(res, "Error to get graph finding 4s");
        }
    },
    graphOverall4s: async (req, res) => {
    try {

        let { start_date, end_date, line_id, status_finding } = req.query;

        // =========================
        // ✅ DEFAULT DATE
        // =========================
        if (!start_date) start_date = moment().format('YYYY-MM-DD');
        if (!end_date) end_date = moment().format('YYYY-MM-DD');

        // =========================
        // ✅ VALIDASI DATE
        // =========================
        const isValidDate = (d) => !isNaN(Date.parse(d));

        if (!isValidDate(start_date) || !isValidDate(end_date)) {
        return response.failed(res, "Invalid date format");
        }

        // =========================
        // ✅ VALIDASI UUID (ANTI INJECTION)
        // =========================
        const uuidRegex = /^[0-9a-fA-F-]{36}$/;

        if (line_id && !uuidRegex.test(line_id)) {
        return response.failed(res, "Invalid line_id");
        }

        // =========================
        // ✅ VALIDASI STATUS (WHITELIST)
        // =========================
        const allowedStatus = ['problem', 'closed', 'remain'];

        if (status_finding && !allowedStatus.includes(status_finding)) {
        return response.failed(res, "Invalid status_finding");
        }

        // =========================
        // ✅ BUILD SAFE QUERY OBJECT
        // =========================
        let safeQuery = {
        start_date,
        end_date
        };

        if (line_id) safeQuery.line_id = line_id;
        if (status_finding) safeQuery.status_finding = status_finding;

        // =========================
        // ✅ CONDITIONS (PAKAI FUNCTION LAMA)
        // =========================
        let conditions = queryCondExacOpAnd(safeQuery, "finding_date");

        // =========================
        // ✅ FINAL WHERE (AMAN)
        // =========================
        let finalWhere = '';

        if (conditions) {
        finalWhere = `WHERE ${condDataNotDeleted} AND ${conditions}`;
        } else {
        finalWhere = `WHERE ${condDataNotDeleted}`;
        }

        // =========================
        // ✅ QUERY
        // =========================
        let q = `SELECT 
            count(finding_id)::int as total,
            status_finding
        FROM ${table.v_4s_finding_list}
        ${finalWhere}
        GROUP BY status_finding`;

        console.log('QUERY:', q);

        let data = await queryCustom(q);

        // =========================
        // ✅ PROCESS DATA
        // =========================
        let sum = data.rows.reduce((n, { total }) => n + total, 0);

        let dataMapPerc = data.rows.map((item) => {
        item.perc = sum > 0 ? +((item.total / sum) * 100).toFixed(1) : 0;
        return item;
        });

        let dataGraph = [
        { name: "problem", data: [0], perc: 0 },
        { name: "closed", data: [0], perc: 0 },
        { name: "remain", data: [0], perc: 0 },
        ];

        for (let i = 0; i < dataMapPerc.length; i++) {
        let element = dataMapPerc[i];

        let findData = dataGraph.find((elem) => elem.name == element.status_finding);

        if (findData) {
            findData.data[0] = element.perc;
            findData.count = element.total;
        }
        }

        response.success(res, "Success to Summary graph 4s", dataGraph);

    } catch (error) {
        console.log('graphOverall4s error:', error);
        response.failed(res, "Error to Summary graph 4s");
    }
    },
};
