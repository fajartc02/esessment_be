const table = require("../../config/table");
const queryCondExacOpAnd = require("../../helpers/conditionsQuery");
const { queryCustom, queryGET } = require("../../helpers/query");
const response = require("../../helpers/response");
const condDataNotDeleted = `deleted_dt IS NULL`;

module.exports = {
        graphFindingSTW: async(req, res) => {
                try {
                  let { start_date, end_date, line_id, group_id } = req.query;

                  // =========================
                  // ✅ HELPER VALIDASI
                  // =========================
                  const uuidRegex = /^[0-9a-fA-F-]{36}$/;
                  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

                  const hasInjection = (val) => {
                    return /('|--|;|\/\*|\*\/|\|\||\bOR\b|\bAND\b|\bCOPY\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b)/i.test(val);
                  };

                  // =========================
                  // ✅ VALIDASI DATE
                  // =========================
                  if (!start_date || !dateRegex.test(start_date) || hasInjection(start_date)) {
                    return response.failed(res, "Invalid start_date");
                  }

                  if (!end_date || !dateRegex.test(end_date) || hasInjection(end_date)) {
                    return response.failed(res, "Invalid end_date");
                  }

                  // fix FE bug
                  end_date = `${end_date}`.replace("/", "");

                  // =========================
                  // ✅ VALIDASI UUID
                  // =========================
                  let isLine = false;
                  let isGroup = false;

                  if (
                    line_id &&
                    line_id !== "null" &&
                    line_id !== "-1" &&
                    line_id !== "-1/"
                  ) {
                    if (!uuidRegex.test(line_id) || hasInjection(line_id)) {
                      return response.failed(res, "Invalid line_id");
                    }
                    isLine = true;
                  }

                  if (
                    group_id &&
                    group_id !== "null" &&
                    group_id !== "-1" &&
                    group_id !== "-1/"
                  ) {
                    if (!uuidRegex.test(group_id) || hasInjection(group_id)) {
                      return response.failed(res, "Invalid group_id");
                    }
                    isGroup = true;
                  }

                  // =========================
                  // ✅ QUERY AMAN
                  // =========================
                  const q = `
                    SELECT uuid as line_id, line_nm, line_snm 
                    FROM tb_m_lines 
                    WHERE ${condDataNotDeleted}
                    ${isLine ? ` AND uuid = '${line_id}'` : ""}
                  `;

                  const rawLines = await queryCustom(q);
                  let linesData = rawLines.rows;

                  // =========================
                  // ✅ MONTH MAPPING
                  // =========================
                  let months = [
                    "January","February","March","April","May","June",
                    "July","August","September","October","November","December",
                  ];

                  let mapLineMonth = months.map((month, i) => ({
                    month,
                    idxMonth: i + 1,
                    ...linesData[0],
                  }));

                  if (isLine) linesData = mapLineMonth;

                  // =========================
                  // ✅ FUNCTION BUILDER (BIAR DRY)
                  // =========================
                  const buildQuery = (line, source, status) => {
                    return `
                      WHERE ${condDataNotDeleted}
                      AND line_id = '${isLine ? line_id : line.line_id}'
                      AND source_category = '${source}'
                      AND status_finding = '${status}'
                      AND finding_date BETWEEN '${start_date}' AND '${end_date}'
                      ${isGroup ? ` AND group_id = '${group_id}'` : ""}
                      ${
                        isLine
                          ? ` AND EXTRACT('MONTH' FROM finding_date)::int = ${line.idxMonth}`
                          : ""
                      }
                      ${
                        isLine
                          ? "GROUP BY source_category, EXTRACT('MONTH' FROM finding_date)"
                          : ""
                      }
                    `;
                  };

                  // =========================
                  // ✅ LOOP DATA
                  // =========================
                  let mapLinesCountFindings = await linesData.map(async (line) => {
                    const getCount = async (source, status) => {
                      const res = await queryGET(
                        table.v_finding_list,
                        buildQuery(line, source, status),
                        [
                          `count(finding_id)::int${
                            isLine
                              ? ", EXTRACT('MONTH' FROM finding_date)::int AS month, source_category"
                              : ""
                          }`,
                        ]
                      );
                      return res[0]?.count ? +res[0].count : 0;
                    };

                    // =========================
                    // ✅ DATA PER CATEGORY
                    // =========================
                    const mv = [
                      await getCount("MV", "problem"),
                      await getCount("MV", "closed"),
                      await getCount("MV", "remain"),
                    ];

                    const obs = [
                      await getCount("Obs", "problem"),
                      await getCount("Obs", "closed"),
                      await getCount("Obs", "remain"),
                    ];

                    const henkaten = [
                      await getCount("H", "problem"),
                      await getCount("H", "closed"),
                      await getCount("H", "remain"),
                    ];

                    const ft = [
                      await getCount("FT", "problem"),
                      await getCount("FT", "closed"),
                      await getCount("FT", "remain"),
                    ];

                    line.chartData = [
                      { name: "Member Voice", data: mv },
                      { name: "Observation", data: obs },
                      { name: "Henkaten", data: henkaten },
                      { name: "Fokus Tema", data: ft },
                    ];

                    return line;
                  });

                  const waitGraphData = await Promise.all(mapLinesCountFindings);

                  response.success(res, "Success to get graph finding STW", waitGraphData);

                } catch (error) {
                  console.log(error);
                  response.failed(res, "Error to get graph finding STW");
                }
  },
  graphOverallSTW: async (req, res) => {
    try {
      let {
        start_date,
        end_date,
        line_id,
        status_finding
      } = req.query;

      // =========================
      // ✅ WHITELIST PARAM
      // =========================
      const allowedParams = ['start_date', 'end_date', 'line_id', 'status_finding'];

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
      const hasInjection = (val) => /('|--|;|\|\||\bOR\b|\bAND\b)/i.test(val);

      // =========================
      // ✅ VALIDASI DATE
      // =========================
      if (!start_date || !dateRegex.test(start_date) || hasInjection(start_date)) {
        return response.failed(res, "Invalid start_date");
      }

      if (!end_date || !dateRegex.test(end_date) || hasInjection(end_date)) {
        return response.failed(res, "Invalid end_date");
      }

      // =========================
      // ✅ VALIDASI UUID
      // =========================
      if (line_id && (!uuidRegex.test(line_id) || hasInjection(line_id))) {
        return response.failed(res, "Invalid line_id");
      }

      // =========================
      // ✅ VALIDASI STATUS
      // =========================
      const allowedStatus = ['problem', 'closed', 'remain'];

      if (status_finding && !allowedStatus.includes(status_finding)) {
        return response.failed(res, "Invalid status_finding");
      }

      // =========================
      // ✅ BUILD SAFE QUERY
      // =========================
      let conditionsArr = [`${condDataNotDeleted}`];

      conditionsArr.push(
        `finding_date BETWEEN '${start_date}' AND '${end_date}'`
      );

      if (line_id) {
        conditionsArr.push(`line_id = '${line_id}'`);
      }

      if (status_finding) {
        conditionsArr.push(`status_finding = '${status_finding}'`);
      }

      let conditions = conditionsArr.join(" AND ");

      let q = `
        SELECT 
          ROUND(count(finding_id)::int) as total,
          status_finding
        FROM v_finding_list
        WHERE ${conditions}
        GROUP BY status_finding
      `;

      console.log("SAFE QUERY:", q);

      let data = await queryCustom(q);

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

      response.success(res, "Success to Summary graph STW", dataGraph);

    } catch (error) {
      console.log(error);
      response.failed(res, "Error to Summary graph STW");
    }
  },
};