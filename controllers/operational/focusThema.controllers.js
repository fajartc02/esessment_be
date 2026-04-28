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
const condDataNotDeleted = `WHERE trft.deleted_dt IS NULL`;

module.exports = {
  addFocusThema: async (req, res) => {
    try {
      let findingData = req.body.findings;
      delete req.body.findings;
      let ftObj = req.body;
      let lastFtId = (await getLastIdData(table.tb_r_focus_theme, "ft_id")) + 1;
      ftObj.ft_id = await lastFtId;
      ftObj.uuid = req.uuid();
      ftObj.ft_line_id =
        (await uuidToId(table.tb_m_lines, "line_id", ftObj.ft_line_id)) ?? null;
      let attrsUserCreated = await attrsUserInsertData(req, ftObj);
      let ftData = await queryPOST(table.tb_r_focus_theme, attrsUserCreated);
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
        finding_ft_id: ftData.rows[0].ft_id,
        ...findingData,
      };
      let attrsUserInsertFinding = await attrsUserInsertData(req, objFinding);
      await queryPOST(table.tb_r_findings, attrsUserInsertFinding);
      response.success(res, "Success to POST Focus Thema");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to POST Focus Thema");
    }
  },
  getFocusThema: async (req, res) => {
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
      // ✅ HELPER VALIDASI (STRICT)
      // =========================
      const uuidRegex = /^[0-9a-fA-F-]{32,36}$/;
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      // Regex ini memastikan input HANYA angka dari awal sampai akhir string
      const isStrictNumeric = (val) => /^\d+$/.test(val);
      const hasInjection = (val) => /('|--|;|\|\||\bOR\b|\bAND\b)/i.test(val);

      // =========================
      // ✅ VALIDASI PAGINATION (ANTI-JEBOL)
      // =========================
      // Jika parameter ada tetapi mengandung karakter selain angka (seperti ; COPY), langsung REJECT
      if (limit && !isStrictNumeric(limit)) {
        return response.failed(res, "Invalid limit");
      }

      if (currentPage && !isStrictNumeric(currentPage)) {
        return response.failed(res, "Invalid currentPage");
      }

      // Setelah dipastikan murni angka, baru aman di-parse
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
        safeQuery.line_id = convertedId;
      }

      // =========================
      // ✅ BUILD CONDITIONS (SAFE)
      // =========================
      let conditions = " AND " + queryCondExacOpAnd(safeQuery, "trft.created_dt");

      // Gunakan variabel numerik murni hasil validasi strict
      const qLimit = `LIMIT ${safeLimit}`;
      const qOffset = safeCurrentPage > 1 ? `OFFSET ${safeLimit * (safeCurrentPage - 1)}` : ``;

      // =========================
      // ✅ MAIN QUERY
      // =========================
      let q = `
        SELECT 
          trft.*,
          trft.uuid as ft_id,
          tml.line_nm,
          tml.uuid as ft_line_id 
        FROM tb_r_focus_theme trft 
        JOIN tb_m_lines tml 
          ON tml.line_id = trft.ft_line_id
        ${condDataNotDeleted}
        ${conditions}
        ${qLimit} ${qOffset}
      `;

      const queryFT = await queryCustom(q);
      const FocusThemaData = queryFT.rows;

      // =========================
      // ✅ SUB QUERY (SAFE)
      // =========================
      const ftFindingsData = await Promise.all(
        FocusThemaData.map(async (ft) => {
          ft.findings = await queryGET(
            table.v_finding_list,
            // Escaping sederhana pada data DB (sebagai best practice)
            `WHERE finding_ft_id = '${ft.uuid.replace(/'/g, "''")}'`
          );
          return ft;
        })
      );

      // =========================
      // ✅ COUNT QUERY
      // =========================
      let qCountTotal = `
        SELECT count(trft.ft_id) as total_page
        FROM tb_r_focus_theme trft 
        JOIN tb_m_lines tml 
          ON tml.line_id = trft.ft_line_id
        ${condDataNotDeleted}
        ${conditions}
      `;

      let total_page_res = await queryCustom(qCountTotal);
      let totalPage = total_page_res.rows[0].total_page;

      if (FocusThemaData.length > 0) {
        // Gunakan totalPage dari hasil query count yang aman
        FocusThemaData[0].total_page = +totalPage > 0 ? Math.ceil(totalPage / safeLimit) : 1;
        FocusThemaData[0].limit = safeLimit;
        FocusThemaData[0].total_data = +totalPage;
        FocusThemaData[0].current_page = safeCurrentPage;
      }

      response.success(res, "Success to GET Focus Thema", ftFindingsData);

    } catch (error) {
      console.log(error);
      response.failed(res, "Error to GET Focus Thema");
    }
  },
  deleteFocusThema: async (req, res) => {
    try {
      let ft_id = await uuidToId(
        table.tb_r_focus_theme,
        "ft_id",
        req.params.id
      );
      let obj = {
        deleted_dt: "CURRENT_TIMESTAMP",
        deleted_by: req.user.fullname,
      };
      await queryPUT(
        table.tb_r_findings,
        obj,
        `WHERE finding_ft_id = '${ft_id}'`
      );
      await queryPUT(table.tb_r_focus_theme, obj, `WHERE ft_id = '${ft_id}'`);
      response.success(res, "Success to DELETE Focus Theme");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to DELETE Focus Theme");
    }
  },
  editFocusThema: async (req, res) => {
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

      req.body.ft_line_id = await uuidToId(
        table.tb_m_lines,
        "line_id",
        req.body.ft_line_id
      );
      let attrsUpdateUserFt = await attrsUserUpdateData(req, req.body);
      let attrsUpdateUserFinding = await attrsUserUpdateData(req, findingsData);

      let ft_id = await uuidToId(
        table.tb_r_focus_theme,
        "ft_id",
        req.params.id
      );

      await queryPUT(
        table.tb_r_findings,
        attrsUpdateUserFinding,
        `WHERE finding_ft_id = '${ft_id}'`
      );
      await queryPUT(
        table.tb_r_focus_theme,
        attrsUpdateUserFt,
        `WHERE ft_id = '${ft_id}'`
      );
      response.success(res, "Success to EDIT Focuss Thema");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to EDIT Focuss Thema");
    }
  },
  editScorefocusThema: async (req, res) => {
    try {
      let FTID = await uuidToId(table.tb_r_focus_theme, "ft_id", req.params.id);
      const scoreUpdate = {
        score: req.body.score,
      };
      let attrsUpdateUserft = await attrsUserUpdateData(req, scoreUpdate);
      console.log("req.params.id:", req.params.id); // pastikan UUID valid
      await queryPUT(
        table.tb_r_focus_theme,
        attrsUpdateUserft,
        `WHERE ft_id = '${FTID}'`
      );

      response.success(res, "Success to EDIT Score of focus Thema");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to edit score of focus Thema");
    }
  },
};
