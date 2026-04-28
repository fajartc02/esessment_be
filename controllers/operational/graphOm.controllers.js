const table = require("../../config/table");
const queryCondExacOpAnd = require("../../helpers/conditionsQuery");
const { queryCustom, queryGET } = require("../../helpers/query");
const response = require("../../helpers/response");
const moment = require('moment')
const condDataNotDeleted = `deleted_dt IS NULL`;

module.exports = {
    graphFindingOm: async (req, res) => {
        try {
            let { start_date, end_date, line_id, group_id, source_tag } = req.query;

            // =========================
            // ✅ WHITELIST PARAM
            // =========================
            const allowedParams = ['start_date','end_date','line_id','group_id','source_tag'];

            for (const key in req.query) {
                if (!allowedParams.includes(key)) {
                return response.failed(res, `Invalid param: ${key}`);
                }
            }

            // =========================
            // ✅ HELPER VALIDASI
            // =========================
            const uuidRegex = /^[0-9a-fA-F-]{32,36}$/;
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            const isSafeString = (val) => /^[a-zA-Z0-9_\s-]+$/.test(val);
            const hasInjection = (val) => /('|--|;|\|\||\bOR\b|\bAND\b)/i.test(val);

            // =========================
            // ✅ DEFAULT DATE
            // =========================
            if (!start_date) start_date = moment().format('YYYY-MM-DD');
            if (!end_date) end_date = moment().format('YYYY-MM-DD');

            // =========================
            // ✅ VALIDASI DATE (STRICT)
            // =========================
            if (!dateRegex.test(start_date) || hasInjection(start_date)) {
                return response.failed(res, "Invalid start_date");
            }

            if (!dateRegex.test(end_date) || hasInjection(end_date)) {
                return response.failed(res, "Invalid end_date");
            }

            // =========================
            // ✅ VALIDASI UUID
            // =========================
            if (line_id && (!uuidRegex.test(line_id) || hasInjection(line_id))) {
                return response.failed(res, "Invalid line_id");
            }

            if (group_id && (!uuidRegex.test(group_id) || hasInjection(group_id))) {
                return response.failed(res, "Invalid group_id");
            }

            // =========================
            // ✅ VALIDASI STRING DINAMIS
            // =========================
            if (source_tag && (!isSafeString(source_tag) || hasInjection(source_tag))) {
                return response.failed(res, "Invalid source_tag");
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
                    when line_nm like '%Line%' then 'Assy Line - ' || line_nm 
                    else line_nm 
                end as line_nm, 
                line_snm 
                FROM ${table.tb_m_lines} 
                WHERE ${condDataNotDeleted}
                ${isLine ? ` AND uuid = '${line_id}'` : ""}
            `;

            const rawLines = await queryCustom(q);
            let linesData = rawLines.rows;

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
            // ✅ FUNCTION BUILDER QUERY
            // =========================
            const buildWhere = (line, status, tag) => {
                return `
                WHERE ${condDataNotDeleted}
                AND line_id = '${isLine ? line_id : line.line_id}'
                AND source_tag = '${tag}'
                AND status_finding = '${status}'
                AND finding_date BETWEEN '${start_date}' AND '${end_date}'
                ${isGroup ? ` AND group_id = '${group_id}'` : ""}
                ${isLine ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}` : ""}
                ${isLine ? ` GROUP BY source_tag, EXTRACT('MONTH' FROM finding_date)` : ""}
                `;
            };

            // =========================
            // ✅ LOOP DATA
            // =========================
            let mapLinesCountFindings = linesData.map(async (line) => {

                const getCount = async (tag, status) => {
                return await queryGET(
                    table.v_om_finding_list,
                    buildWhere(line, status, tag),
                    [
                    `count(finding_id)::int${
                        isLine ? ", EXTRACT('MONTH' FROM finding_date)::int AS month, source_tag" : ""
                    }`,
                    ]
                );
                };

                let redProblem = await getCount('Tag Red','problem');
                let redClosed = await getCount('Tag Red','closed');
                let redRemain = await getCount('Tag Red','remain');

                let whiteProblem = await getCount('Tag White','problem');
                let whiteClosed = await getCount('Tag White','closed');
                let whiteRemain = await getCount('Tag White','remain');

                const safe = (val) => +val?.[0]?.count || 0;

                line.chartData = [
                {
                    name: "Tag Red",
                    data: [safe(redProblem), safe(redClosed), safe(redRemain)],
                },
                {
                    name: "Tag White",
                    data: [safe(whiteProblem), safe(whiteClosed), safe(whiteRemain)],
                },
                ];

                return line;
            });

            let result = await Promise.all(mapLinesCountFindings);

            response.success(res, "Success tp get graph finding om", result);

            } catch (error) {
            console.log(error);
            response.failed(res, "Error to get graph finding om");
            }
    },
    graphOverallOm: async (req, res) => {
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
            FROM ${table.v_om_finding_list}
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
            response.success(res, "Success to Summary graph om", dataGraph);
        } catch (error)
        {
            console.log('graphOverallom', error)
            response.failed(res, "Error to Summary graph om");
        }
    },
};
