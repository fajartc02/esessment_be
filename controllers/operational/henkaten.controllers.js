const table = require("../../config/table");
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");
const queryCondExacOpAnd = require("../../helpers/conditionsQuery");
const getLastIdData = require("../../helpers/getLastIdData");
const {
  queryPOST,
  queryCustom,
  queryGET,
  queryPUT,
} = require("../../helpers/query");
const response = require("../../helpers/response");
const uuidToId = require("../../helpers/uuidToId");
const condDataNotDeleted = `WHERE henkaten.deleted_dt IS NULL`;

module.exports = {
  addHenkaten: async (req, res) => {
    try {
      let findingData = req.body.findings;
      delete req.body.findings;
      let henkatenObj = req.body;
      let lasthenkatenId =
        (await getLastIdData(table.tb_r_henkaten, "henkaten_id")) + 1;
      henkatenObj.henkaten_id = await lasthenkatenId;
      henkatenObj.uuid = req.uuid();
      henkatenObj.henkaten_pic =
        (await uuidToId(
          table.tb_m_users,
          "user_id",
          henkatenObj.henkaten_pic
        )) ?? null;
      henkatenObj.henkaten_line_id =
        (await uuidToId(
          table.tb_m_lines,
          "line_id",
          henkatenObj.henkaten_line_id
        )) ?? null;
      let attrsUserCreated = await attrsUserInsertData(req, henkatenObj);
      console.log(attrsUserCreated);
      let henkatenData = await queryPOST(table.tb_r_henkaten, attrsUserCreated);

      let lastFindingId =
        (await getLastIdData(table.tb_r_findings, "finding_id")) + 1;
      findingData.category_id =
        findingData.category_id != "" && findingData.category_id
          ? (await uuidToId(
            table.tb_m_categories,
            "category_id",
            findingData.category_id
          )) ?? null
          : null;
      findingData.cm_pic_id =
        (await uuidToId(table.tb_m_users, "user_id", findingData.cm_pic_id)) ??
        null;
      findingData.pic_supervisor_id = findingData.pic_supervisor_id ? `(select user_id from ${table.tb_m_users} where uuid = '${findingData.pic_supervisor_id}')` : null;
      findingData.factor_id =
        (await uuidToId(
          table.tb_m_factors,
          "factor_id",
          findingData.factor_id
        )) ?? null;
      findingData.line_id =
        (await uuidToId(table.tb_m_lines, "line_id", findingData.line_id)) ??
        null;
      findingData.cm_result_factor_id =
        (await uuidToId(
          table.tb_m_factors,
          "factor_id",
          findingData.cm_result_factor_id
        )) ?? null;
      let objFinding = {
        finding_id: lastFindingId,
        uuid: req.uuid(),
        finding_henkaten_id: henkatenData.rows[0].henkaten_id,
        ...findingData,
      };
      let attrsUserInsertFinding = await attrsUserInsertData(req, objFinding);
      await queryPOST(table.tb_r_findings, attrsUserInsertFinding);
      response.success(res, "Success to POST Henkaten");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to POST Henkaten");
    }
  },
  getHenkaten: async (req, res) => {
    try {
      let { start_date, end_date, line_id, limit, currentPage } = req.query;

      // =========================
      // ✅ WHITELIST PARAM
      // =========================
      const allowedParams = ['start_date', 'end_date', 'line_id', 'limit', 'currentPage'];

      for (const key in req.query) {
        if (!allowedParams.includes(key)) {
          return response.failed(res, `Invalid param: ${key}`);
        }
      }

      // =========================
      // ✅ HELPER VALIDASI STRICT
      // =========================
      const uuidRegex = /^[0-9a-fA-F-]{32,36}$/;
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      // Regex untuk memastikan HANYA angka (mencegah ; COPY dsb)
      const isStrictNumeric = (val) => /^\d+$/.test(val);
      const hasInjection = (val) => /('|--|;|\|\||\bOR\b|\bAND\b)/i.test(val);

      // ==========================================
      // ✅ VALIDASI PAGINATION (ANTI-INJECTION)
      // ==========================================
      // Jika limit/currentPage mengandung karakter ilegal, langsung return failed
      if (limit && !isStrictNumeric(limit)) {
        return response.failed(res, "Invalid limit");
      }

      if (currentPage && !isStrictNumeric(currentPage)) {
        return response.failed(res, "Invalid currentPage");
      }

      // Setelah dipastikan murni angka melalui regex, baru di-parse
      const safeLimit = parseInt(limit) || 10;
      const safeCurrentPage = parseInt(currentPage) || 1;

      if (safeLimit < 1 || safeLimit > 100) {
        return response.failed(res, "Invalid limit range");
      }

      // =========================
      // ✅ VALIDASI DATE & UUID
      // =========================
      if (start_date && (!dateRegex.test(start_date) || hasInjection(start_date))) {
        return response.failed(res, "Invalid start_date");
      }

      if (end_date && (!dateRegex.test(end_date) || hasInjection(end_date))) {
        return response.failed(res, "Invalid end_date");
      }

      if (line_id && (!uuidRegex.test(line_id) || hasInjection(line_id))) {
        return response.failed(res, "Invalid line_id");
      }

      // =========================
      // ✅ BUILD SAFE QUERY OBJECT
      // =========================
      let safeQuery = {};
      if (start_date) safeQuery.start_date = start_date;
      if (end_date) safeQuery.end_date = end_date;

      if (line_id) {
        const convertedId = await uuidToId(table.tb_m_lines, "line_id", line_id);
        if (!convertedId) return response.failed(res, "Line not found");
        safeQuery["henkaten.henkaten_line_id"] = convertedId;
      }

      // =========================
      // ✅ BUILD CONDITIONS (SAFE)
      // =========================
      let conditions = " AND " + queryCondExacOpAnd(safeQuery, "henkaten.created_dt");

      // Gunakan variabel numerik murni hasil validasi strict
      const qLimit = `LIMIT ${safeLimit}`;
      const qOffset = safeCurrentPage > 1 ? `OFFSET ${safeLimit * (safeCurrentPage - 1)}` : ``;

      // =========================
      // ✅ MAIN QUERY
      // =========================
      let q = `
        SELECT 
          henkaten.*,
          henkaten.uuid as henkaten_id,
          tmu.uuid as henkaten_pic,
          tmu.noreg || '-' || tmu.fullname as henkaten_pic_nm,
          tml.line_nm,
          tml.uuid as henkaten_line_id
        FROM tb_r_henkaten henkaten 
        JOIN tb_m_lines tml 
          ON tml.line_id = henkaten.henkaten_line_id
        JOIN tb_m_users tmu
          ON tmu.user_id = henkaten.henkaten_pic
        ${condDataNotDeleted}
        ${conditions}
        ${qLimit} ${qOffset}
      `;

      const queryhenkaten = await queryCustom(q);
      const HenkatenData = queryhenkaten.rows;

      // =========================
      // ✅ SUB QUERY (SAFE)
      // =========================
      const waithenkatenFindings = await Promise.all(
        HenkatenData.map(async (henkaten) => {
          // Escaping sederhana pada variabel UUID yang masuk ke string query
          const safeUuid = henkaten.uuid.replace(/'/g, "''");
          henkaten.findings = await queryGET(
            table.v_finding_list,
            `WHERE finding_henkaten_id = '${safeUuid}' ORDER BY finding_date DESC`
          );
          return henkaten;
        })
      );

      // =========================
      // ✅ COUNT QUERY
      // =========================
      let qCountTotal = `
        SELECT count(henkaten.henkaten_id) as total_page
        FROM tb_r_henkaten henkaten 
        JOIN tb_m_lines tml 
          ON tml.line_id = henkaten.henkaten_line_id
        JOIN tb_m_users tmu
          ON tmu.user_id = henkaten.henkaten_pic
        ${condDataNotDeleted}
        ${conditions}
      `;

      let total_page_res = await queryCustom(qCountTotal);
      let totalData = total_page_res.rows[0].total_page;

      if (HenkatenData.length > 0) {
        HenkatenData[0].total_page = +totalData > 0 ? Math.ceil(totalData / safeLimit) : 1;
        HenkatenData[0].limit = safeLimit;
        HenkatenData[0].total_data = +totalData;
        HenkatenData[0].current_page = safeCurrentPage;
      }

      response.success(res, "Success to GET Henkaten", waithenkatenFindings);

    } catch (error) {
      console.log(error);
      response.failed(res, "Error to GET Henkaten");
    }
  },
  deleteHenkaten: async (req, res) => {
    try {
      let henkaten_id = await uuidToId(
        table.tb_r_henkaten,
        "henkaten_id",
        req.params.id
      );
      let obj = {
        deleted_dt: "CURRENT_TIMESTAMP",
        deleted_by: req.user.fullname,
      };
      await queryPUT(
        table.tb_r_findings,
        obj,
        `WHERE finding_henkaten_id = '${henkaten_id}'`
      );
      await queryPUT(
        table.tb_r_henkaten,
        obj,
        `WHERE henkaten_id = '${henkaten_id}'`
      );
      response.success(res, "Success to DELETE Henkaten");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to DELETE Henkaten");
    }
  },
  editHenkaten: async (req, res) => {
    try {
      let findingsData = {
        ...req.body.findings,
        line_id: await uuidToId(
          table.tb_m_lines,
          "line_id",
          req.body.findings.line_id
        ),
        category_id:
          req.body.findings.category_id != "" && req.body.findings.category_id
            ? await uuidToId(
              table.tb_m_categories,
              "category_id",
              req.body.findings.category_id
            )
            : null,
        factor_id: await uuidToId(
          table.tb_m_factors,
          "factor_id",
          req.body.findings.factor_id
        ),
        cm_pic_id: await uuidToId(
          table.tb_m_users,
          "user_id",
          req.body.findings.cm_pic_id
        ),
        pic_supervisor_id: req.body.findings.pic_supervisor_id ? `(select user_id from ${table.tb_m_users} where uuid = '${req.body.findings.pic_supervisor_id}')` : null,
        cm_result_factor_id: await uuidToId(
          table.tb_m_factors,
          "factor_id",
          req.body.findings.cm_result_factor_id
        ),
      };

      delete req.body.findings;

      req.body.henkaten_line_id = await uuidToId(
        table.tb_m_lines,
        "line_id",
        req.body.henkaten_line_id
      );
      req.body.henkaten_pic = await uuidToId(
        table.tb_m_users,
        "user_id",
        req.body.henkaten_pic
      );

      let attrsUpdateUserFt = await attrsUserUpdateData(req, req.body);
      let attrsUpdateUserFinding = await attrsUserUpdateData(req, findingsData);

      let henkaten_id = await uuidToId(
        table.tb_r_henkaten,
        "henkaten_id",
        req.params.id
      );

      await queryPUT(
        table.tb_r_findings,
        attrsUpdateUserFinding,
        `WHERE finding_henkaten_id = '${henkaten_id}'`
      );
      await queryPUT(
        table.tb_r_henkaten,
        attrsUpdateUserFt,
        `WHERE henkaten_id = '${henkaten_id}'`
      );
      response.success(res, "Success to EDIT Henkaten");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to EDIT Henkaten");
    }
  },
  editScoreHenkanten: async (req, res) => {
    try {
      let HkId = await uuidToId(
        table.tb_r_henkaten,
        "henkaten_id",
        req.params.id
      );
      const scoreUpdate = {
        score: req.body.score,
      };
      let attrsUpdateUserHK = await attrsUserUpdateData(req, scoreUpdate);

      await queryPUT(
        table.tb_r_henkaten,
        attrsUpdateUserHK,
        `WHERE henkaten_id = '${HkId}'`
      );

      response.success(res, "Success to EDIT Score of Henkaten");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to edit score of Henkaten");
    }
  },
};
