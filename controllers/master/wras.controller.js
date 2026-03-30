const table = require("../../config/table");
const {
  queryExcelPost,
  queryPUT,
  queryDELETE,
  queryCustom,
} = require("../../helpers/query");
const { database } = require("../../config/database");
const getLastIdData = require("../../helpers/getLastIdData");
const response = require("../../helpers/response");
// const uuidToId = require("../../helpers/uuidToId"); // Not needed if we store UUIDs

module.exports = {
  postWras: async (req, res) => {
    try {
      // === Generate ID baru (UUID) ===
      let idLast = req.uuid();

      // === Use UUIDs directly (Schema has UUID columns) ===
      let plant_id = req.body.plant || null;
      let shop_id = req.body.shop || null;
      let line_id = req.body.line || null;
      let pos_id = req.body.pos || null;
      let job_id = req.body.sop || null;

      // === Parse file dari FE (kalau ada) ===
      let filePayload = req.body.file;
      if (typeof filePayload === "string") {
        filePayload = JSON.parse(filePayload);
      }

      // === Build body untuk insert ===
      const insertBody = {
        wras_id: idLast,
        file: filePayload ? JSON.stringify(filePayload) : null,
        plant_id,
        shop_id,
        line_id,
        pos_id,
        job_id,
      };

      console.log("[InsertBody WRAS]", insertBody);

      // === Insert ke DB ===
      const result = await queryExcelPost(table.tb_m_wras, insertBody);

      response.success(res, "Success to add WRAS", result);
    } catch (error) {
      console.error("[postWras] ERROR:", error);
      response.failed(res, error.message || error);
    }
  },

  getWras: async (req, res) => {
    try {
      // NOTE: Join on UUID columns, cast to text to avoid type mismatch if FK is UUID and PK is VARCHAR
      const sql = `
      SELECT 
        w.*,
        p.uuid as plant, p.plant_nm,
        s.uuid as shop, s.shop_nm,
        l.uuid as line, l.line_nm,
        po.uuid as pos, po.pos_nm,
        j.uuid as sop, j.job_nm
      FROM ${table.tb_m_wras} w
      LEFT JOIN ${table.tb_m_plants} p ON w.plant_id::text = p.uuid
      LEFT JOIN ${table.tb_m_shop} s ON w.shop_id::text = s.uuid
      LEFT JOIN ${table.tb_m_lines} l ON w.line_id::text = l.uuid
      LEFT JOIN ${table.tb_m_pos} po ON w.pos_id::text = po.uuid
      LEFT JOIN ${table.tb_m_jobs} j ON w.job_id::text = j.uuid
    `;

      const result = await queryCustom(sql);

      return response.success(res, "Success get WRAS", result.rows);
    } catch (error) {
      console.error(error);
      return response.failed(res, error.message || error);
    }
  },

  putWras: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return response.failed(res, "WRAS id wajib ada");
      }

      // Build update arrays for parameterized query
      const setClauses = [];
      const values = [];
      let paramCounter = 1;

      // Handle file update (same parsing logic as postWras)
      if (req.body.file) {
        let filePayload = req.body.file;
        if (typeof filePayload === "string") {
          filePayload = JSON.parse(filePayload);
        }
        setClauses.push(`file = $${paramCounter++}`);
        values.push(JSON.stringify(filePayload));
      }

      // Handle relationship updates if provided
      if (req.body.plant !== undefined) {
        setClauses.push(`plant_id = $${paramCounter++}`);
        values.push(req.body.plant || null);
      }
      if (req.body.shop !== undefined) {
        setClauses.push(`shop_id = $${paramCounter++}`);
        values.push(req.body.shop || null);
      }
      if (req.body.line !== undefined) {
        setClauses.push(`line_id = $${paramCounter++}`);
        values.push(req.body.line || null);
      }
      if (req.body.pos !== undefined) {
        setClauses.push(`pos_id = $${paramCounter++}`);
        values.push(req.body.pos || null);
      }
      if (req.body.sop !== undefined) {
        setClauses.push(`job_id = $${paramCounter++}`);
        values.push(req.body.sop || null);
      }

      if (setClauses.length === 0) {
        return response.failed(res, "No fields to update");
      }

      // Add wras_id to values
      values.push(id);

      // Build parameterized SQL query
      const sql = `
        UPDATE ${table.tb_m_wras}
        SET ${setClauses.join(", ")}
        WHERE wras_id = $${paramCounter}
        RETURNING *
      `;

      console.log("[UpdateWRAS] SQL:", sql.replace(/\s+/g, ' ').trim());
      console.log("[UpdateWRAS] Param count:", values.length);

      // Use database.query directly with parameters
      const result = await database.query(sql, values);

      return response.success(res, "Success update WRAS", result.rows[0]);
    } catch (error) {
      console.error(error);
      return response.failed(res, error.message || error);
    }
  },

  deleteWras: async (req, res) => {
    try {
      // update record berdasarkan id
      const result = await queryDELETE(
        table.tb_m_wras,
        `WHERE wras_id = '${req.params.id}'`
      );

      response.success(res, "Success to  delete WRAS", result);
    } catch (error) {
      console.error(error);
      response.failed(res, error.message || error);
    }
  },
};

