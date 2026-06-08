const table = require("../../config/table");
const {
  queryPOST,
  queryCustom,
  queryGET,
  queryPUT,
} = require("../../helpers/query");
const response = require("../../helpers/response");

const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const addAttrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");

const queryCondExacOpAnd = require("../../helpers/conditionsQuery");
const removeFileIfExist = require("../../helpers/removeFileIfExist");
const uuidToId = require("../../helpers/uuidToId");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");
const condDataNotDeleted = `WHERE deleted_dt IS NULL AND `;

module.exports = {
  getFindingCm: async (req, res) => {
    try {
      let {
        start_date,
        end_date,
        line_id,
        limit,
        currentPage,
        status_finding,
        source_category
      } = req.query;

      // ==========================================
      // 1. WHITELIST PARAMETER
      // ==========================================
      const allowedParams = [
        'start_date', 'end_date', 'line_id', 'limit', 
        'currentPage', 'status_finding', 'source_category'
      ];

      for (const key in req.query) {
        if (!allowedParams.includes(key)) {
          return response.failed(res, `Invalid query parameter: ${key}`);
        }
      }

      // ==========================================
      // 2. VALIDASI STRICT (ANTI-BYPASS)
      // ==========================================
      
      // Validasi Date & UUID
      const isValidDate = (d) => !isNaN(Date.parse(d));
      const uuidRegex = /^[0-9a-fA-F-]{32,36}$/;

      if (start_date && !isValidDate(start_date)) return response.failed(res, "Invalid start_date");
      if (end_date && !isValidDate(end_date)) return response.failed(res, "Invalid end_date");
      
      if (line_id && !uuidRegex.test(line_id)) {
        return response.failed(res, "Invalid line_id");
      }

      // REGEX: Hanya boleh angka saja (0-9). Tidak boleh ada karakter lain.
      const numericRegex = /^[0-9]+$/;

      // Validasi Limit: Jika ada isinya tapi bukan murni angka, langsung return failed
      if (limit && !numericRegex.test(limit)) {
        return response.failed(res, "Invalid limit");
      }

      // Validasi CurrentPage: Sama seperti limit
      if (currentPage && !numericRegex.test(currentPage)) {
        return response.failed(res, "Invalid currentPage");
      }

      // Setelah lolos regex, baru aman untuk di-parse
      const safeLimit = parseInt(limit) || 10;
      const safePage = parseInt(currentPage) || 1;

      if (safeLimit < 1 || safeLimit > 100) {
        return response.failed(res, "Invalid limit range");
      }

      // ==========================================
      // 3. SANITASI STRING
      // ==========================================
      const cleanStr = (val) => (val ? String(val).replace(/'/g, "''") : val);

      const allowedStatus = ['problem', 'closed', 'remain'];
      if (status_finding && !allowedStatus.includes(status_finding)) {
        return response.failed(res, "Invalid status_finding");
      }

      if (source_category && !/^[a-zA-Z0-9\s-_]+$/.test(source_category)) {
        return response.failed(res, "Invalid source_category");
      }

      // ==========================================
      // 4. BUILD CONDITIONS
      // ==========================================
      let conditionsArr = [`deleted_dt IS NULL`];

      if (start_date && end_date) {
        conditionsArr.push(`finding_date BETWEEN '${cleanStr(start_date)}' AND '${cleanStr(end_date)}'`);
      }

      if (line_id) {
        conditionsArr.push(`line_id = '${cleanStr(line_id)}'`);
      }

      if (status_finding) {
        conditionsArr.push(`status_finding = '${cleanStr(status_finding)}'`);
      }

      if (source_category) {
        conditionsArr.push(`source_category = '${cleanStr(source_category)}'`);
      }

      let conditions = `WHERE ${conditionsArr.join(' AND ')}`;
      let qLimit = `LIMIT ${safeLimit}`;
      let qOffset = `OFFSET ${safeLimit * (safePage - 1)}`;

      // ==========================================
      // 5. EXECUTION
      // ==========================================
      
      let findingCmData = await queryGET(
        table.v_finding_list,
        `${conditions} ORDER BY finding_date DESC ${qLimit} ${qOffset}`
      );

      let qCountTotal = `
        SELECT count(finding_id) as total_page
        FROM ${table.v_finding_list}
        ${conditions}
      `;

      let total_page_res = await queryCustom(qCountTotal);
      let totalData = total_page_res.rows[0].total_page;

      if (findingCmData.length > 0) {
        findingCmData[0].total_page = +totalData > 0 ? Math.ceil(totalData / safeLimit) : 1;
        findingCmData[0].limit = safeLimit;
        findingCmData[0].total_data = +totalData;
        findingCmData[0].current_page = safePage;
      }

      response.success(res, "Success to get findingCm list", findingCmData);

    } catch (error) {
      console.log(error);
      response.failed(res, "Error to get findingCm list");
    }
  },
  uploadPinksheet: async (req, res) => {
    try {
      if (req.file) {
        req.body.file_pinksheet = `./${req.file.path}`;
      }

      let finding_id = `${await uuidToId(
        table.tb_r_findings,
        "finding_id",
        req.body.finding_id
      )}`;
      if (
        req.body.before_path != null &&
        req.body.before_path != "null" &&
        req.body.before_path
      ) {
        removeFileIfExist(req.body.before_path);
      }

      delete req.body.dest;
      delete req.body.finding_id;
      delete req.body.before_path;

      // Update tb_r_finding SET file_pinksheet = req.file.path
      await queryPUT(
        table.tb_r_findings,
        req.body,
        `WHERE finding_id = '${finding_id}'`
      );
      response.success(
        res,
        "Success to upload pinksheet",
        req.body.file_pinksheet
      );
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to upload kaizen report");
    }
  },
  uploadImageFinding: async (req, res) => {
    try {
      let resFile = `./${req.file.path}`;
      if (
        req.body.before_path != null &&
        req.body.before_path != "null" &&
        req.body.before_path
      ) {
        removeFileIfExist(req.body.before_path);
        response.success(res, "success to edit file", resFile);
      } else {
        response.success(res, "success to upload file", resFile);
      }
    } catch (error) {
      response.failed(res, "Error to Upload finding Image");
    }
  },
  uploadImageCmFinding: async (req, res) => {
    try {
      console.log(req.file);
      console.log(req.body);
      if (!req.file) {
        return response.failed(res, "Image is empty");
      }
      const payload = {
        cm_image: `./${req.file.path}`,
      };
      const attrsUserUpdate = await attrsUserUpdateData(req, payload);
      await queryPUT(
        table.tb_r_findings,
        attrsUserUpdate,
        `WHERE uuid = '${req.body.finding_id}'`
      );
      response.success(res, "Success to upload finding image");
    } catch (error) {
      response.failed(res, "Error to Upload finding Image");
    }
  },
  uploadKzFinding: async (req, res) => {
    try {
      console.log(req.file);
      console.log(req.body);
      if (!req.file) {
        return response.failed(res, "Image is empty");
      }
      const payload = {
        kaizen_file: `./${req.file.path}`,
      };
      const attrsUserUpdate = await attrsUserUpdateData(req, payload);
      await queryPUT(
        table.tb_r_findings,
        attrsUserUpdate,
        `WHERE uuid = '${req.body.finding_id}'`
      );
      response.success(res, "Success to upload finding image");
    } catch (error) {
      response.failed(res, "Error to Upload finding Image");
    }
  },
  signFinding: async (req, res) => {
    try {
      let finding_id = await uuidToId(
        table.tb_r_findings,
        "finding_id",
        req.body.finding_id
      );
      let objRes = req.body;
      let attrsUpdateUserFinding = await attrsUserUpdateData(req, req.body);
      // console.log(attrsUpdateUserFinding);
      delete req.body.finding_id;
      await queryPUT(
        table.tb_r_findings,
        attrsUpdateUserFinding,
        `WHERE finding_id = '${finding_id}'`
      );
      response.success(res, "success to sign finding", objRes);
    } catch (error) {
      response.failed(res, "Error to sign finding");
    }
  },
  editFindingCm: async (req, res) => {
    try {
      let finding_id = await uuidToId(
        table.tb_r_findings,
        "finding_id",
        req.params.id
      );



      let findingsData = {
        ...req.body,
        line_id: await uuidToId(table.tb_m_lines, "line_id", req.body.line_id),
        category_id: await uuidToId(
          table.tb_m_categories,
          "category_id",
          req.body.category_id
        ),
        factor_id: await uuidToId(
          table.tb_m_factors,
          "factor_id",
          req.body.factor_id
        ),
        cm_pic_id: req.body.cm_pic_id ? `(select user_id from ${table.tb_m_users} where uuid = '${req.body.cm_pic_id}')` : null,
        cm_result_factor_id: await uuidToId(
          table.tb_m_factors,
          "factor_id",
          req.body.cm_result_factor_id
        ),
        pic_supervisor_id: req.body.pic_supervisor_id
          ? `(select user_id from ${table.tb_m_users} where uuid = '${req.body.pic_supervisor_id}')`
          : null,
      };

      let attrsUpdateUserFinding = await attrsUserUpdateData(req, findingsData);
      await queryPUT(
        table.tb_r_findings,
        attrsUpdateUserFinding,
        `WHERE finding_id = '${finding_id}'`
      );

      response.success(res, "Success to EDIT Finding");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to edit finding");
    }
  },
  editscoreFinding: async (req, res) => {
    try {
      let finding_id = await uuidToId(
        table.tb_r_findings,
        "finding_id",
        req.params.id
      );
      const scoreUpdate = {
        score: req.body.score,
      };
      console.log("dataaa", scoreUpdate);
      let attrsUpdateUserFinding = await attrsUserUpdateData(req, scoreUpdate);

      await queryPUT(
        table.tb_r_findings,
        attrsUpdateUserFinding,
        `WHERE finding_id = '${finding_id}'`
      );

      response.success(res, "Success to EDIT Score of Finding");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to edit score of finding");
    }
  },

  deleteFinding: async (req, res) => {
    try {
      let finding_id = await uuidToId(
        table.tb_r_findings,
        "finding_id",
        req.params.id
      );
      let obj = {
        deleted_dt: "CURRENT_TIMESTAMP",
        deleted_by: req.user.fullname,
      };

      await queryPUT(
        table.tb_r_findings,
        obj,
        `WHERE finding_id = '${finding_id}'`
      );
      response.success(res, "Success to DELETE finding");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to DELETE finding");
    }
  },
};
