const table = require("../../../config/table");
const { queryPOST, queryGET, queryPUT } = require("../../../helpers/query");

const response = require("../../../helpers/response");
const getLastIdData = require("../../../helpers/getLastIdData");
const uuidToId = require("../../../helpers/uuidToId");

const attrsUserInsertData = require("../../../helpers/addAttrsUserInsertData");

const moment = require("moment");
const getLastIdDataNew = require("../../../helpers/getLastIdDataNew");
const uuidToIdV2 = require("../../../helpers/uuidToIdV2");

module.exports = {
  addSign: async (req, res) => {
    try {
      const data = req.body;
      data.line_id = await uuidToId(table.tb_m_lines, "line_id", data.line_id);
      await queryPOST(table.tb_r_stw_sign, data);

      response.success(res, "Success to add sign");
    } catch (error) {
      console.log(error);
      response.error(res, "Error to add sign");
    }
  },
  getSign: async (req, res) => {
    try {
      const { month, year, role_sign_sys, line_id } = req.query;

      // =========================
      // ✅ HELPER
      // =========================
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;
      const numberRegex = /^[0-9]+$/;
      const hasInjection = (val) =>
        /('|--|;|\|\||\/\*|\*\/|\bOR\b|\bAND\b|\bCOPY\b|\bSELECT\b)/i.test(val);

      // =========================
      // ✅ VALIDASI MONTH & YEAR (STRICT)
      // =========================
      if (!month || !year || !numberRegex.test(month) || !numberRegex.test(year)) {
        return response.failed(res, "Invalid month/year format");
      }

      const m = parseInt(month);
      const y = parseInt(year);

      if (m < 1 || m > 12 || y < 2000 || y > 2100) {
        return response.failed(res, "Invalid month/year value");
      }

      // =========================
      // ✅ VALIDASI ROLE (WHITELIST)
      // =========================
      const allowedRoles = ["TL_1", "TL_2", "GL", "SH"];

      if (!role_sign_sys || !allowedRoles.includes(role_sign_sys)) {
        return response.failed(res, "Invalid role_sign_sys");
      }

      // =========================
      // ✅ VALIDASI UUID (STRICT)
      // =========================
      if (!line_id || !uuidRegex.test(line_id) || hasInjection(line_id)) {
        return response.failed(res, "Invalid line_id");
      }

      // =========================
      // ✅ DOUBLE CHECK INJECTION
      // =========================
      if (hasInjection(role_sign_sys) || hasInjection(month) || hasInjection(year)) {
        return response.failed(res, "Invalid input detected");
      }

      // =========================
      // ✅ CONVERT UUID → ID
      // =========================
      const safeLineId = await uuidToId(
        table.tb_m_lines,
        "line_id",
        line_id
      );

      if (!safeLineId) {
        return response.failed(res, "Line not found");
      }

      // =========================
      // ✅ FINAL QUERY (SAFE)
      // =========================
      const data = await queryGET(
        table.tb_r_stw_sign,
        `WHERE EXTRACT(MONTH FROM date_sign) = ${m}
        AND EXTRACT(YEAR FROM date_sign) = ${y}
        AND role_sign_sys = '${role_sign_sys}'
        AND line_id = ${safeLineId}`
      );

      response.success(res, "Success to get sign", data);

    } catch (error) {
      console.log(error);
      response.failed(res, "Error to get sign");
    }
  },
  editSign: async (req, res) => {
    try {
      const id = req.params.id;

      // ==========================================
      // ✅ 1. ANTI MASS ASSIGNMENT: STRICT FIELD CHECK
      // ==========================================
      const incomingFields = Object.keys(req.body);
      const allowedFields = ['sign'];

      const hasExtraFields = incomingFields.some(field => !allowedFields.includes(field));

      if (hasExtraFields) {
        return response.error(res, "Invalid payload: Only 'sign' field is allowed");
      }

      // ==========================================
      // ✅ 2. VALIDASI SQL INJECTION PADA ID
      // ==========================================
      if (!/^[0-9]+$/.test(id)) {
        return response.error(res, "Invalid ID format");
      }

      // ==========================================
      // ✅ 3. CEK EKSISTENSI ID (PENTING!)
      // ==========================================
      const existingData = await queryGET(
        table.tb_r_stw_sign,
        `WHERE id = ${id}`
      );

      if (!existingData || existingData.length === 0) {
        return response.error(res, "Data not found or you don't have access to this ID");
      }

      // ==========================================
      // ✅ 4. VALIDASI DATA 'SIGN'
      // ==========================================
      const { sign } = req.body;

      if (!sign || sign === "") {
        return response.error(res, "Field 'sign' is required");
      }

      if (!sign.startsWith("data:image/")) {
        return response.error(res, "Invalid sign format (must be base64 image)");
      }

      // ==========================================
      // ✅ 5. KONSTRUKSI DATA (CLEAN OBJECT)
      // ==========================================
      const updateData = { sign };

      const dataWithAttrs = await attrsUserInsertData(req, updateData);
      delete dataWithAttrs.changed_by;
      delete dataWithAttrs.changed_dt;

      console.log("Edit Sign Payload:", {
        id,
        dataWithAttrs,
      });

      // ==========================================
      // ✅ 6. EKSEKUSI UPDATE
      // ==========================================
      await queryPUT(table.tb_r_stw_sign, dataWithAttrs, `WHERE id = ${id}`);

      response.success(res, "Success to edit sign", dataWithAttrs);
    } catch (error) {
      console.log(error);
      response.error(res, "Error to edit sign");
    }
  },
};
