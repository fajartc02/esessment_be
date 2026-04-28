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
const condDataNotDeleted = `WHERE trmv.deleted_dt IS NULL`;

module.exports = {
  addMemberVoice: async (req, res) => {
    try {
      let {
        mv_date_finding,
        mv_location,
        mv_problem,
        mv_process_no,
        mv_category,
        mv_factor_id,
        mv_countermeasure,
        mv_evaluation,
        mv_plan_date,
        mv_actual_date,
        line_id,
        mv_pic_id,
      } = req.body;
      let mvObj = {
        mv_date_finding,
        mv_location,
        mv_problem,
        mv_process_no,
        mv_category,
        mv_factor_id,
        mv_countermeasure,
        mv_evaluation,
        mv_plan_date,
        mv_actual_date,
        line_id,
        mv_pic_id,
      };

      mvObj.mv_id = (await getLastIdData(table.tb_r_member_voice, "mv_id")) + 1;
      mvObj.uuid = await req.uuid();
      mvObj.mv_pic_id = await uuidToId(table.tb_m_users, "user_id", mv_pic_id);
      mvObj.line_id = await uuidToId(table.tb_m_lines, "line_id", line_id);
      mvObj.mv_factor_id = await uuidToId(
        table.tb_m_factors,
        "factor_id",
        mv_factor_id
      );
      let attrsUserCreated = await attrsUserInsertData(req, mvObj);
      console.log(req.body.findings);
      let mvData = await queryPOST(table.tb_r_member_voice, attrsUserCreated);

      // INSERT TO TB_R_FINDINGS
      let lastFindingId =
        (await getLastIdData(table.tb_r_findings, "finding_id")) + 1;
      req.body.findings.category_id =
        req.body.findings.category_id != "" && req.body.findings.category_id
          ? (await uuidToId(
            table.tb_m_categories,
            "category_id",
            req.body.findings.category_id
          )) ?? null
          : null;
      req.body.findings.cm_pic_id =
        (await uuidToId(
          table.tb_m_users,
          "user_id",
          req.body.findings.cm_pic_id
        )) ?? null;
      req.body.findings.factor_id =
        (await uuidToId(
          table.tb_m_factors,
          "factor_id",
          req.body.findings.factor_id
        )) ?? null;
      req.body.findings.line_id =
        (await uuidToId(
          table.tb_m_lines,
          "line_id",
          req.body.findings.line_id
        )) ?? null;
      req.body.findings.cm_result_factor_id =
        (await uuidToId(
          table.tb_m_factors,
          "factor_id",
          req.body.findings.cm_result_factor_id
        )) ?? null;

      req.body.findings.pic_supervisor_id =
        (await uuidToId(
          table.tb_m_users,
          "user_id",
          req.body.findings.pic_supervisor_id
        )) ?? null;

      let dataFinding = {
        uuid: req.uuid(),
        finding_id: lastFindingId,
        finding_mv_id: mvData.rows[0].mv_id,
        finding_date: req.body.findings.finding_date ?? mv_date_finding,
        ...req.body.findings,
      };
      console.log(dataFinding);
      let attrsUserInsertFinding = await attrsUserInsertData(req, dataFinding);
      await queryPOST(table.tb_r_findings, attrsUserInsertFinding);
      response.success(res, "Success to POST Member Voice");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to POST member voice");
    }
  },
  getMemberVoice: async (req, res) => {
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
      // Regex khusus angka: hanya boleh berisi digit dari awal sampai akhir
      const numericRegex = /^[0-9]+$/;
      const hasInjection = (val) => /('|--|;|\|\||\bOR\b|\bAND\b)/i.test(val);

      // =========================
      // ✅ VALIDASI PAGINATION (STRICT)
      // =========================
      // Jika parameter ada, tapi bukan murni angka (mengandung ; COPY dsb), langsung REJECT
      if (limit && !numericRegex.test(limit)) {
        return response.failed(res, "Invalid limit");
      }
      if (currentPage && !numericRegex.test(currentPage)) {
        return response.failed(res, "Invalid currentPage");
      }

      // Setelah lolos regex, baru aman dikonversi ke Number
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

      if (end_date && !dateRegex.test(end_date) || hasInjection(end_date)) {
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
        safeQuery["tml.line_id"] = convertedId;
      }

      // =========================
      // ✅ BUILD CONDITIONS AMAN
      // =========================
      let conditions = " AND " + queryCondExacOpAnd(safeQuery, "trmv.created_dt");

      // Menggunakan variable yang sudah di-parse (safeLimit & safeCurrentPage)
      const qLimit = `LIMIT ${safeLimit}`;
      const qOffset = safeCurrentPage > 1 ? `OFFSET ${safeLimit * (safeCurrentPage - 1)}` : ``;

      // =========================
      // ✅ MAIN QUERY
      // =========================
      let q = `
        SELECT 
          trmv.*,
          trmv.uuid as mv_id,
          tmfac.uuid as mv_factor_id,
          tmu.uuid as mv_pic_id,
          tmu.noreg || '-' || tmu.fullname as mv_pic_nm,
          date_part('week', trmv.mv_plan_date) AS w_mv_plan_date,
          date_part('week', trmv.mv_actual_date) AS w_mv_actual_date,
          tml.line_nm,
          tml.uuid as line_id,
          CASE
            WHEN trmv.mv_plan_date < CURRENT_DATE AND trmv.mv_actual_date IS NULL THEN 'DELAY'
            WHEN trmv.mv_actual_date IS NULL THEN 'PROGRESS'
            WHEN trmv.mv_actual_date IS NOT NULL THEN 'DONE'
          END AS status_check 
        FROM tb_r_member_voice trmv 
        JOIN tb_m_lines tml ON tml.line_id = trmv.line_id
        JOIN tb_m_users tmu ON tmu.user_id = trmv.mv_pic_id
        JOIN tb_m_factors tmfac ON tmfac.factor_id = trmv.mv_factor_id
        ${condDataNotDeleted}
        ${conditions}
        ${qLimit} ${qOffset}
      `;

      const queryMV = await queryCustom(q);
      const memberVoiceData = queryMV.rows;

      // Sub query untuk findings
      const waitMvFindings = await Promise.all(
        memberVoiceData.map(async (mv) => {
          mv.findings = await queryGET(
            table.v_finding_list,
            // Gunakan replace untuk escape single quote pada mv.uuid jika perlu
            `WHERE finding_mv_id = '${mv.uuid.replace(/'/g, "''")}'`
          );
          return mv;
        })
      );

      // =========================
      // ✅ COUNT QUERY
      // =========================
      let qCountTotal = `
        SELECT count(trmv.mv_id) as total_page
        FROM tb_r_member_voice trmv 
        JOIN tb_m_lines tml ON tml.line_id = trmv.line_id
        JOIN tb_m_users tmu ON tmu.user_id = trmv.mv_pic_id
        ${condDataNotDeleted}
        ${conditions}
      `;

      let total_page_res = await queryCustom(qCountTotal);
      let totalData = total_page_res.rows[0].total_page;

      if (waitMvFindings.length > 0) {
        waitMvFindings[0].total_page = +totalData > 0 ? Math.ceil(totalData / safeLimit) : 1;
        waitMvFindings[0].limit = safeLimit;
        waitMvFindings[0].total_data = +totalData;
        waitMvFindings[0].current_page = safeCurrentPage;
      }

      response.success(res, "Success to GET member voice", waitMvFindings);

    } catch (error) {
      console.log(error);
      response.failed(res, "Error to GET member voice");
    }
  },
  editMemberVoice: async (req, res) => {
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
        cm_result_factor_id: await uuidToId(
          table.tb_m_factors,
          "factor_id",
          req.body.findings.cm_result_factor_id
        ),
        pic_supervisor_id: req.body.findings?.pic_supervisor_id ? `(select user_id from ${table.tb_m_users} where uuid = '${req.body.findings.pic_supervisor_id}')` : null
      };

      delete req.body.findings;

      let mvData = {
        ...req.body,
        line_id: await uuidToId(table.tb_m_lines, "line_id", req.body.line_id),
        mv_factor_id: await uuidToId(
          table.tb_m_factors,
          "factor_id",
          req.body.mv_factor_id
        ),
        mv_pic_id: await uuidToId(
          table.tb_m_users,
          "user_id",
          req.body.mv_pic_id
        ),
      };
      let attrsUpdateUserFinding = await attrsUserUpdateData(req, findingsData);
      let attrsUpdateUserMv = await attrsUserUpdateData(req, mvData);
      let mv_id = await uuidToId(
        table.tb_r_member_voice,
        "mv_id",
        req.params.id
      );

      await queryPUT(
        table.tb_r_findings,
        attrsUpdateUserFinding,
        `WHERE finding_mv_id = '${mv_id}'`
      );
      await queryPUT(
        table.tb_r_member_voice,
        attrsUpdateUserMv,
        `WHERE mv_id = '${mv_id}'`
      );
      response.success(res, "Success to EDIT Member Voice");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to EDIT member voice");
    }
  },
  editScoreMemberVoice: async (req, res) => {
    try {
      let mv_id = await uuidToId(
        table.tb_r_member_voice,
        "mv_id",
        req.params.id
      );
      const scoreUpdate = {
        score: req.body.score,
      };
      let attrsUpdateUserMV = await attrsUserUpdateData(req, scoreUpdate);

      await queryPUT(
        table.tb_r_member_voice,
        attrsUpdateUserMV,
        `WHERE mv_id = '${mv_id}'`
      );

      response.success(res, "Success to EDIT Score of MV");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to edit score of MV");
    }
  },
  deleteMemberVoice: async (req, res) => {
    // console.log(req.params);
    try {
      let mv_id = await uuidToId(
        table.tb_r_member_voice,
        "mv_id",
        req.params.id
      );
      let obj = {
        deleted_dt: "CURRENT_TIMESTAMP",
        deleted_by: req.user.fullname,
      };
      await queryPUT(
        table.tb_r_findings,
        obj,
        `WHERE finding_mv_id = '${mv_id}'`
      );
      await queryPUT(table.tb_r_member_voice, obj, `WHERE mv_id = '${mv_id}'`);
      response.success(res, "Success to DELETE Member Voice");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to DELETE member voice");
    }
  },
};
