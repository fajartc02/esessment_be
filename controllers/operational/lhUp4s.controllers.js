const table = require("../../config/table");
const {
  queryPUT,
  queryCustom,
  queryPOST,
  queryTransaction,
  queryPostTransaction,
  queryPutTransaction,
} = require("../../helpers/query");

const response = require("../../helpers/response");
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");

const moment = require("moment");
const { uuid } = require("uuidv4");
const { databasePool } = require("../../config/database");

module.exports = {
  // ==========================================
  // SCHEDULE HANDLERS
  // ==========================================

  getSchedules: async (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

      let filterCondition = ["s.deleted_dt IS NULL"];
      const params = [];
      let paramCount = 1;

      if (start_date) {
        if (!isValidDate(start_date)) {
          return response.failed(res, "Invalid start_date format");
        }
        filterCondition.push(`s.date >= $${paramCount++}`);
        params.push(start_date);
      }

      if (end_date) {
        if (!isValidDate(end_date)) {
          return response.failed(res, "Invalid end_date format");
        }
        filterCondition.push(`s.date <= $${paramCount++}`);
        params.push(end_date);
      }

      const sql = `
        SELECT s.lh_up_schedule_id, s.uuid, to_char(s.date, 'YYYY-MM-DD') as date, s.line_id, l.uuid as line_uuid, l.line_nm, s.created_by, s.created_dt
        FROM ${table.tb_r_4s_lh_up_schedules} s
        JOIN ${table.tb_m_lines} l ON s.line_id = l.line_id
        WHERE ${filterCondition.join(" AND ")}
        ORDER BY s.date DESC
      `;

      const result = await databasePool.query(sql, params);
      response.success(res, "Success to get 4S LH Up schedules", result.rows);
    } catch (error) {
      console.error(error);
      response.failed(res, "Error to get schedules: " + error.message);
    }
  },

  createSchedule: async (req, res) => {
    try {
      const { date, line_uuid } = req.body;

      const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;

      if (!date || !isValidDate(date)) {
        return response.failed(res, "Invalid or missing date");
      }
      if (!line_uuid || !uuidRegex.test(line_uuid)) {
        return response.failed(res, "Invalid or missing line_uuid");
      }

      // Check if line exists
      const lineCheck = await databasePool.query(
        `SELECT line_id FROM ${table.tb_m_lines} WHERE uuid = $1 AND deleted_dt IS NULL`,
        [line_uuid]
      );
      if (lineCheck.rowCount === 0) {
        return response.failed(res, "Line not found");
      }
      const line_id = lineCheck.rows[0].line_id;

      // Check if schedule date and line already exists
      const scheduleCheck = await databasePool.query(
        `SELECT lh_up_schedule_id FROM ${table.tb_r_4s_lh_up_schedules} WHERE date = $1 AND line_id = $2 AND deleted_dt IS NULL`,
        [date, line_id]
      );
      if (scheduleCheck.rowCount > 0) {
        return response.failed(res, "Schedule for this date already exists");
      }

      const insertData = {
        uuid: uuid(),
        date,
        line_id,
      };

      const attrsInsert = await attrsUserInsertData(req, insertData);
      const insertResult = await queryPOST(table.tb_r_4s_lh_up_schedules, attrsInsert);

      response.success(res, "Success to create schedule", insertResult.rows[0]);
    } catch (error) {
      console.error(error);
      response.failed(res, "Error to create schedule: " + error.message);
    }
  },

  deleteSchedule: async (req, res) => {
    try {
      const { id } = req.params;
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;

      if (!id || !uuidRegex.test(id)) {
        return response.failed(res, "Invalid schedule UUID");
      }

      const check = await databasePool.query(
        `SELECT lh_up_schedule_id FROM ${table.tb_r_4s_lh_up_schedules} WHERE uuid = $1 AND deleted_dt IS NULL`,
        [id]
      );
      if (check.rowCount === 0) {
        return response.failed(res, "Schedule not found");
      }

      const updateData = {
        deleted_dt: moment().format("YYYY-MM-DD HH:mm:ss"),
        deleted_by: req.user?.fullname || "SYSTEM",
      };

      const attrsUpdate = await attrsUserUpdateData(req, updateData);
      await queryPUT(table.tb_r_4s_lh_up_schedules, attrsUpdate, `WHERE uuid = '${id}'`);

      response.success(res, "Success to delete schedule");
    } catch (error) {
      console.error(error);
      response.failed(res, "Error to delete schedule: " + error.message);
    }
  },

  getTodayLine: async (req, res) => {
    try {
      const queryDate = req.query.date || moment().format("YYYY-MM-DD");
      const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

      if (!isValidDate(queryDate)) {
        return response.failed(res, "Invalid date format");
      }

      const sql = `
        SELECT s.lh_up_schedule_id, s.uuid as schedule_uuid, s.date, s.line_id, l.uuid as line_uuid, l.line_nm
        FROM ${table.tb_r_4s_lh_up_schedules} s
        JOIN ${table.tb_m_lines} l ON s.line_id = l.line_id
        WHERE s.date = $1 AND s.deleted_dt IS NULL
      `;

      const result = await databasePool.query(sql, [queryDate]);
      if (result.rowCount === 0) {
        return response.success(res, "No schedule for this date", null);
      }

      response.success(res, "Schedule found", result.rows[0]);
    } catch (error) {
      console.error(error);
      response.failed(res, "Error to get today's line: " + error.message);
    }
  },

  // ==========================================
  // FINDINGS HANDLERS
  // ==========================================

  getFindings: async (req, res) => {
    try {
      let { limit, current_page, start_date, end_date, line_id, status } = req.query;

      const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

      current_page = parseInt(current_page ?? 1);
      limit = parseInt(limit ?? 10);

      if (isNaN(limit) || isNaN(current_page) || limit < 1 || limit > 1000) {
        return response.failed(res, "Invalid pagination parameters");
      }

      const qOffset = current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : "";
      const qLimit = `LIMIT ${limit}`;

      let filterCondition = ["f.deleted_dt IS NULL"];
      const params = [];
      let paramCount = 1;

      if (start_date) {
        if (!isValidDate(start_date)) {
          return response.failed(res, "Invalid start_date");
        }
        filterCondition.push(`f.finding_date >= $${paramCount++}`);
        params.push(start_date);
      }

      if (end_date) {
        if (!isValidDate(end_date)) {
          return response.failed(res, "Invalid end_date");
        }
        filterCondition.push(`f.finding_date <= $${paramCount++}`);
        params.push(end_date);
      }

      if (line_id) {
        filterCondition.push(`l.uuid = $${paramCount++}`);
        params.push(line_id);
      }

      if (status) {
        if (status === 'closed') {
          filterCondition.push(`f.cm_image IS NOT NULL`);
        } else if (status === 'remain') {
          filterCondition.push(`f.cm_image IS NULL`);
        }
      }

      if (req.query.found_by) {
        filterCondition.push(`f.found_by = $${paramCount++}`);
        params.push(req.query.found_by);
      }

      const sqlCount = `
        SELECT count(*)::integer as count 
        FROM ${table.tb_r_4s_lh_up_findings} f
        JOIN ${table.tb_m_lines} l ON f.line_id = l.line_id
        WHERE ${filterCondition.join(" AND ")}
      `;
      const countRes = await databasePool.query(sqlCount, params);
      const totalData = countRes.rows[0]?.count || 0;

      const sqlList = `
        SELECT f.lh_up_finding_id, f.uuid, f.finding_date, f.finding_desc, f.finding_img, f.cm_image,
               f.line_id, l.uuid as line_uuid, l.line_nm,
               f.found_by, u.fullname as found_by_nm, u.noreg as found_by_noreg,
               f.lh_up_schedule_id, s.uuid as schedule_uuid
        FROM ${table.tb_r_4s_lh_up_findings} f
        JOIN ${table.tb_m_lines} l ON f.line_id = l.line_id
        JOIN ${table.tb_m_users} u ON f.found_by = u.user_id
        LEFT JOIN ${table.tb_r_4s_lh_up_schedules} s ON f.lh_up_schedule_id = s.lh_up_schedule_id
        WHERE ${filterCondition.join(" AND ")}
        ORDER BY f.finding_date DESC, f.created_dt DESC
        ${qLimit} ${qOffset}
      `;

      const listRes = await databasePool.query(sqlList, params);

      // Map hosts for images
      const list = listRes.rows.map(item => {
        const baseUrl = process.env.IMAGE_URL || (req.protocol + "://" + req.get("host") + "/api/v1/file?path=");
        if (item.finding_img) {
          item.finding_img = item.finding_img.startsWith("./")
            ? baseUrl + item.finding_img
            : item.finding_img;
        }
        if (item.cm_image) {
          item.cm_image = item.cm_image.startsWith("./")
            ? baseUrl + item.cm_image
            : item.cm_image;
        }
        return item;
      });

      // Calculate Best Contributor
      const sqlBestContributor = `
        SELECT u.user_id as found_by, u.fullname, count(f.lh_up_finding_id)::integer as finding_count
        FROM ${table.tb_r_4s_lh_up_findings} f
        JOIN ${table.tb_m_lines} l ON f.line_id = l.line_id
        JOIN ${table.tb_m_users} u ON f.found_by = u.user_id
        WHERE ${filterCondition.join(" AND ")}
        GROUP BY u.user_id, u.fullname
        ORDER BY finding_count DESC
        LIMIT 1
      `;
      const bestContributorRes = await databasePool.query(sqlBestContributor, params);
      const best_contributor = bestContributorRes.rows.length > 0 ? bestContributorRes.rows[0] : null;

      response.success(res, "Success to get 4S LH Up findings", {
        current_page,
        total_page: totalData > 0 ? Math.ceil(totalData / limit) : 0,
        total_data: totalData,
        limit,
        list,
        best_contributor
      });
    } catch (error) {
      console.error(error);
      response.failed(res, "Error to get findings: " + error.message);
    }
  },

  postFinding: async (req, res) => {
    try {
      const { finding_desc } = req.body;
      const today = moment().format("YYYY-MM-DD");

      // Resolve schedule for today
      const scheduleRes = await databasePool.query(
        `SELECT lh_up_schedule_id, line_id FROM ${table.tb_r_4s_lh_up_schedules} WHERE date = $1 AND deleted_dt IS NULL`,
        [today]
      );

      if (scheduleRes.rowCount === 0) {
        return response.failed(res, "No schedule configured for today. Cannot log findings.");
      }

      const schedule = scheduleRes.rows[0];

      // Get logged in user's database ID
      const userRes = await databasePool.query(
        `SELECT user_id FROM ${table.tb_m_users} WHERE uuid = $1 AND deleted_dt IS NULL`,
        [req.user.uuid]
      );
      if (userRes.rowCount === 0) {
        return response.failed(res, "User validation failed");
      }
      const found_by = userRes.rows[0].user_id;

      const insertData = {
        uuid: uuid(),
        lh_up_schedule_id: schedule.lh_up_schedule_id,
        finding_date: today,
        line_id: schedule.line_id,
        found_by: found_by,
        finding_desc: finding_desc || "",
      };

      const attrsInsert = await attrsUserInsertData(req, insertData);
      const result = await queryPOST(table.tb_r_4s_lh_up_findings, attrsInsert);

      response.success(res, "Success to add finding", {
        finding_uuid: result.rows[0].uuid,
      });
    } catch (error) {
      console.error(error);
      response.failed(res, "Error to save finding: " + error.message);
    }
  },

  uploadFindingImage: async (req, res) => {
    try {
      const { finding_uuid } = req.body;
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;

      if (!finding_uuid || !uuidRegex.test(finding_uuid)) {
        return response.failed(res, "Invalid finding_uuid");
      }

      if (!req.file) {
        return response.failed(res, "No file uploaded");
      }

      const finding_img = `./${req.file.path.replace(/\\/g, "/")}`;
      const attrsUpdate = await attrsUserUpdateData(req, { finding_img });

      await queryPUT(table.tb_r_4s_lh_up_findings, attrsUpdate, `WHERE uuid = '${finding_uuid}'`);

      response.success(res, "Success to upload finding image", finding_img);
    } catch (error) {
      console.error(error);
      response.failed(res, "Error to upload image: " + error.message);
    }
  },

  uploadCmImage: async (req, res) => {
    try {
      const { finding_uuid } = req.body;
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;

      if (!finding_uuid || !uuidRegex.test(finding_uuid)) {
        return response.failed(res, "Invalid finding_uuid");
      }

      if (!req.file) {
        return response.failed(res, "No file uploaded");
      }

      const cm_image = `./${req.file.path.replace(/\\/g, "/")}`;
      const attrsUpdate = await attrsUserUpdateData(req, { cm_image });

      await queryPUT(table.tb_r_4s_lh_up_findings, attrsUpdate, `WHERE uuid = '${finding_uuid}'`);

      response.success(res, "Success to upload countermeasure image", cm_image);
    } catch (error) {
      console.error(error);
      response.failed(res, "Error to upload image: " + error.message);
    }
  },

  getFindingsGraph: async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

      let joinCondition = ["f.deleted_dt IS NULL"];
      const params = [];
      let paramCount = 1;

      if (start_date) {
        if (!isValidDate(start_date)) {
          return response.failed(res, "Invalid start_date");
        }
        joinCondition.push(`f.finding_date >= $${paramCount++}`);
        params.push(start_date);
      }

      if (end_date) {
        if (!isValidDate(end_date)) {
          return response.failed(res, "Invalid end_date");
        }
        joinCondition.push(`f.finding_date <= $${paramCount++}`);
        params.push(end_date);
      }

      const sql = `
        SELECT 
            l.line_id,
            l.uuid as line_uuid,
            l.line_nm,
            count(f.lh_up_finding_id)::int as total_findings,
            count(case when f.cm_image is not null and f.cm_image != '' then 1 end)::int as closed_findings,
            count(case when f.lh_up_finding_id is not null and (f.cm_image is null or f.cm_image = '') then 1 end)::int as remain_findings
        FROM ${table.tb_m_lines} l
        LEFT JOIN ${table.tb_r_4s_lh_up_findings} f ON l.line_id = f.line_id AND ${joinCondition.join(" AND ")}
        WHERE l.deleted_dt IS NULL
        GROUP BY l.line_id, l.uuid, l.line_nm
        ORDER BY l.line_nm ASC
      `;

      const result = await databasePool.query(sql, params);
      response.success(res, "Success to get graph data", result.rows);
    } catch (error) {
      console.error(error);
      response.failed(res, "Error to get graph data: " + error.message);
    }
  },

  updateFinding: async (req, res) => {
    try {
      const uuid = req.params.uuid;
      const { finding_desc } = req.body;
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;

      if (!uuid || !uuidRegex.test(uuid)) {
        return response.failed(res, "Invalid finding uuid");
      }
      if (!finding_desc) {
        return response.failed(res, "Finding description is required");
      }

      const attrsUpdate = await attrsUserUpdateData(req, { finding_desc });
      await queryPUT(table.tb_r_4s_lh_up_findings, attrsUpdate, `WHERE uuid = '${uuid}'`);

      response.success(res, "Success to update finding");
    } catch (error) {
      console.error(error);
      response.failed(res, "Error to update finding: " + error.message);
    }
  },

  deleteFinding: async (req, res) => {
    try {
      const uuid = req.params.uuid;
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;

      if (!uuid || !uuidRegex.test(uuid)) {
        return response.failed(res, "Invalid finding uuid");
      }

      const attrsUpdate = await attrsUserUpdateData(req, { deleted_dt: new Date() });
      await queryPUT(table.tb_r_4s_lh_up_findings, attrsUpdate, `WHERE uuid = '${uuid}'`);

      response.success(res, "Success to delete finding");
    } catch (error) {
      console.error(error);
      response.failed(res, "Error to delete finding: " + error.message);
    }
  }
};
