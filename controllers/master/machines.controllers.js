const table = require("../../config/table");
const {
  queryGET,
  queryCustom,
  queryPOST,
  queryPUT,
} = require("../../helpers/query");

const response = require("../../helpers/response");
const getLastIdData = require("../../helpers/getLastIdData");
const uuidToId = require("../../helpers/uuidToId");
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");
const condDataNotDeleted = `tmm.deleted_dt IS NULL`;

const moment = require("moment");

module.exports = {
  getMachines: async (req, res) => {
    try {
      let { line_id, category_type, id, limit, currentPage } = req.query;

      // =========================
      // ✅ HELPER VALIDASI
      // =========================
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;
      const safeString = /^[A-Za-z0-9_ ]+$/; 
      const numericRegex = /^[0-9]+$/; // HANYA boleh angka
      const forbidden = /('|--|;|\|\||\bOR\b|\bAND\b|=)/i;

      const validate = (val, type) => {
        if (!val) return val;

        val = String(val).trim();

        // Validasi Injeksi Umum
        if (forbidden.test(val)) {
          throw new Error(`Invalid ${type} (SQL Injection detected)`);
        }

        // Validasi Tipe Data
        if (type === "uuid" && !uuidRegex.test(val)) {
          throw new Error(`Invalid ${type}`);
        }

        if (type === "string" && !safeString.test(val)) {
          throw new Error(`Invalid ${type}`);
        }

        // Validasi Angka Ketat (Mencegah bypass limit=5; COPY...)
        if (type === "numeric" && !numericRegex.test(val)) {
          throw new Error(`Invalid ${type}`);
        }

        if (val.length > 50) {
          throw new Error(`${type} too long`);
        }

        return val;
      };

      // =========================
      // ✅ VALIDASI INPUT (TERMASUK PAGINATION)
      // =========================
      try {
        id = validate(id, "uuid");
        line_id = validate(line_id, "uuid");
        category_type = validate(category_type, "string");
        
        // Validasi limit dan currentPage secara strict
        if (limit) validate(limit, "numeric");
        if (currentPage) validate(currentPage, "numeric");
      } catch (err) {
        return response.failed(res, err.message);
      }

      // =========================
      // ✅ PAGINATION (SAFE)
      // =========================
      // Setelah lolos regex numeric, baru aman di-parse
      const safeLimit = parseInt(limit) || 10;
      const safeCurrentPage = parseInt(currentPage) || 1;

      if (safeLimit < 1 || safeLimit > 100) {
        return response.failed(res, "Invalid limit range");
      }

      let qLimit = `LIMIT ${safeLimit}`;
      let qOffset = safeCurrentPage > 1 ? `OFFSET ${safeLimit * (safeCurrentPage - 1)}` : "";

      // =========================
      // ✅ BUILD QUERY AMAN
      // =========================
      let containerQuery = "";

      if (id) {
        // Escaping tambahan untuk keamanan berlapis
        containerQuery += ` AND tmm.uuid = '${id.replace(/'/g, "''")}'`;
      }

      if (line_id && line_id !== "-1" && line_id !== "null") {
        containerQuery += ` AND tml.uuid = '${line_id.replace(/'/g, "''")}'`;
      }

      if (category_type) {
        containerQuery += ` AND tmm.category_type = '${category_type.replace(/'/g, "''")}'`;
      }

      // =========================
      // ✅ MAIN QUERY
      // =========================
      let q = `
        SELECT 
          row_number() over(order by tmm.uuid DESC) as no, 
          tmm.uuid as id,
          tmm.machine_nm,
          tmm.op_no,
          tml.uuid as line_id,
          tml.line_nm,
          tmm.category_type,
          tmm.created_by,
          tmm.created_dt
        FROM ${table.tb_m_machines} tmm
        JOIN ${table.tb_m_lines} tml ON tml.line_id = tmm.line_id
        WHERE ${condDataNotDeleted}
        ${containerQuery}
        ${qLimit} ${qOffset}
      `;

      let qCountTotal = `
        SELECT count(machine_id) as count
        FROM ${table.tb_m_machines} tmm
        JOIN ${table.tb_m_lines} tml ON tml.line_id = tmm.line_id
        WHERE ${condDataNotDeleted}
        ${containerQuery}
      `;

      // =========================
      // ✅ EXECUTE
      // =========================
      const machines = await queryCustom(q);
      const totalMachine = await queryCustom(qCountTotal);

      if (machines.rows.length > 0) {
        const totalData = +totalMachine.rows[0].count;
        machines.rows[0].total_page = totalData > 0 ? Math.ceil(totalData / safeLimit) : 0;
        machines.rows[0].limit = safeLimit;
        machines.rows[0].total_data = totalData;
        machines.rows[0].currentPage = safeCurrentPage;
      }

      response.success(res, "Success to get Machines", machines.rows);

    } catch (error) {
      console.log(error);
      response.failed(res, error.message || "Error to get Machines");
    }
  },
  postMachine: async (req, res) => {
    try
    {
      let idLast = (await getLastIdData(table.tb_m_machines, "machine_id")) + 1;
      req.body.machine_id = idLast;
      req.body.uuid = req.uuid();
      let idLine = await uuidToId(
        table.tb_m_lines,
        "line_id",
        req.body.line_id
      );
      req.body.line_id = idLine;
      let attrsUserInsert = await attrsUserInsertData(req, req.body);
      const result = await queryPOST(table.tb_m_machines, attrsUserInsert);
      response.success(res, "Success to add machine", result);
    } catch (error)
    {
      console.log(error);
      response.failed(res, error);
    }
  },
  editMachine: async (req, res) => {
    try
    {
      let id = await uuidToId(table.tb_m_machines, "machine_id", req.params.id);
      let idLine = await uuidToId(
        table.tb_m_lines,
        "line_id",
        req.body.line_id
      );
      req.body.line_id = idLine;

      const attrsUserUpdate = await attrsUserUpdateData(req, req.body);
      const result = await queryPUT(
        table.tb_m_machines,
        attrsUserUpdate,
        `WHERE machine_id = '${id}'`
      );
      response.success(res, "Success to edit machine", result);
    } catch (error)
    {
      console.log(error);
      response.failed(res, error);
    }
  },
  deleteMachine: async (req, res) => {
    try
    {
      let obj = {
        deleted_dt: moment().format().split("+")[0].split("T").join(" "),
        deleted_by: req.user.fullname,
      };
      let attrsUserUpdate = await attrsUserUpdateData(req, obj);
      const result = await queryPUT(
        table.tb_m_machines,
        attrsUserUpdate,
        `WHERE uuid = '${req.params.id}'`
      );
      response.success(res, "Success to soft delete machine", result);
    } catch (error)
    {
      console.log(error);
      response.failed(res, error);
    }
  },
};
