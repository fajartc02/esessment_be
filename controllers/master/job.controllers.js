const moment = require("moment");
const table = require("../../config/table");
const {
  queryPOST,
  queryCustom,
  queryGET,
  queryPUT,
  queryDELETE,
} = require("../../helpers/query");
const fs = require("fs");

const response = require("../../helpers/response");
const getLastIdData = require("../../helpers/getLastIdData");
const uuidToId = require("../../helpers/uuidToId");
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");
const condDataNotDeleted = `WHERE tmj.deleted_dt IS NULL`;
const orderBy = `ORDER BY tmj.created_dt DESC`;

module.exports = {
  getJob: async (req, res) => {
    try {
      let { id, line_id, pos_id, limit, currentPage, totalPage, job_no } =
        req.query;
      let containerQuery = "";
      let qLimit = ``;
      let qOffset =
        limit != -1 && limit && currentPage > 1
          ? `OFFSET ${limit * (currentPage - 1)}`
          : ``;
      if (limit != -1 && limit) qLimit = `LIMIT ${limit}`;
      if (id) containerQuery += ` AND tmj.uuid = '${id}'`;
      if (pos_id && pos_id != -1 && pos_id != "null")
        containerQuery += ` AND tmp.uuid = '${pos_id}'`;
      if (line_id && line_id != -1 && line_id != "null")
        containerQuery += ` AND tml.uuid = '${line_id}'`;
      if (job_no) containerQuery += ` AND LOWER(tmj.job_no) LIKE '%${job_no}%'`;
      console.log(containerQuery);
      let q = `
                SELECT
                    row_number() over(order by tmj.created_dt DESC) as no, 
                    tmj.uuid as id,
                    tmj.uuid,
                    tmj.job_no,
                    tmj.job_nm,
                    tmjt.job_type_nm,
                    tmjt.uuid as job_type_id,
                    tmp.uuid as pos_id,
                    tmp.pos_nm,
                    tml.uuid as line_id,
                    tml.line_nm,
                    tmm.machine_nm,
                    tmm.uuid as machine_id,
                    tmj.attachment,
                    tmj.created_by,
                    tmj.created_dt
                FROM ${table.tb_m_jobs} tmj
                LEFT JOIN ${table.tb_m_job_types} tmjt ON tmj.job_type_id = tmjt.job_type_id
                LEFT JOIN ${table.tb_m_pos} tmp ON tmp.pos_id = tmj.pos_id
                LEFT JOIN ${table.tb_m_machines} tmm ON tmj.machine_id = tmm.machine_id 
                LEFT JOIN ${table.tb_m_lines} tml ON tmp.line_id = tml.line_id
                ${condDataNotDeleted}
                ${containerQuery}
                ${orderBy} ${qLimit} ${qOffset}
            `;
      const job = await queryCustom(q);
      let qCountTotal = `SELECT 
            count(tmj.job_id)
        FROM ${table.tb_m_jobs} tmj
        LEFT JOIN ${table.tb_m_job_types} tmjt ON tmj.job_type_id = tmjt.job_type_id
        LEFT JOIN ${table.tb_m_pos} tmp ON tmp.pos_id = tmj.pos_id
        LEFT JOIN ${table.tb_m_machines} tmm ON tmj.machine_id = tmm.machine_id 
        LEFT JOIN ${table.tb_m_lines} tml ON tmp.line_id = tml.line_id
        ${condDataNotDeleted}
        ${containerQuery}`;
      console.log(job);
      const countJobTotal = await queryCustom(
        `SELECT COUNT(job_id) as total_data FROM tb_m_jobs tmj ${condDataNotDeleted}
        ${containerQuery}`
      );
      if (job.rows.length > 0) {
        const total_job = await queryCustom(qCountTotal);
        job.rows[0].total_page =
          +total_job.rows[0].count > 0
            ? Math.ceil(total_job.rows[0].count / +limit)
            : 0;
        job.rows[0].limit = +limit;
        job.rows[0].total_data = +countJobTotal.rows[0].total_data;
        job.rows[0].currentPage = currentPage;
      }

      response.success(res, "Success to get job", job.rows);
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to get job");
    }
  },
  postJob: async (req, res) => {
    try {
      /* 
                                                                            pos_id,job_type_id,machine_id, job_nm, attachment, job_no, 
                                                                        */
      // console.log(req.body);
      let idLast = (await getLastIdData(table.tb_m_jobs, "job_id")) + 1;
      req.body.job_id = idLast;
      req.body.uuid = req.uuid();
      if (req.body.machine_id != "null" && req.body.machine_id) {
        req.body.machine_id = await uuidToId(
          table.tb_m_machines,
          "machine_id",
          req.body.machine_id
        );
      } else {
        req.body.machine_id = null;
        delete req.body.machine_id;
      }
      req.body.job_type_id = await uuidToId(
        table.tb_m_job_types,
        "job_type_id",
        req.body.job_type_id
      );
      req.body.pos_id = await uuidToId(
        table.tb_m_pos,
        "pos_id",
        req.body.pos_id
      );
      // console.log(req.file);
      if (req.file) {
        req.body.attachment = `./${req.file.path}`;
      }
      delete req.body.dest;

      let attrsUserInsert = await attrsUserInsertData(req, req.body);
      const result = await queryPOST(table.tb_m_jobs, attrsUserInsert);
      response.success(res, "Success to add job", result);
    } catch (error) {
      console.log(error);
      response.failed(res, error);
    }
  },
  editJob: async (req, res) => {
    try {
      console.log(req.body);
      if (req.body.machine_id != "null" && req.body.machine_id) {
        req.body.machine_id = await uuidToId(
          table.tb_m_machines,
          "machine_id",
          req.body.machine_id
        );
      } else {
        req.body.machine_id = null;
        delete req.body.machine_id;
      }
      console.log(req.file);
      req.body.job_type_id = await uuidToId(
        table.tb_m_job_types,
        "job_type_id",
        req.body.job_type_id
      );
      req.body.pos_id = await uuidToId(
        table.tb_m_pos,
        "pos_id",
        req.body.pos_id
      );
      if (req.file) {
        const jobs = await queryGET(
          table.tb_m_jobs,
          `WHERE uuid = '${req.params.id}'`,
          ["attachment"]
        );
        let isFileExist = jobs[0].attachment;
        if (isFileExist) {
          fs.unlink(isFileExist, function (err) {
            // console.log(err);
            if (err) {
              // 1.a JIKA ERROR MAKA KIRIM MSG KE FE
              // return res.status(500).json({msg: 'error'})
            }
            // 1.b JIKA TIDAK ERROR, MAKA UPDATE TB_ERROR_LOG_2 / URAIAN SET attachment (colmn tertentu sesuai image table)
            // DENGAN NULL VALUE
            // 2. send response ke FE res.status(200).json({msg: 'success'})
          });
        }
        console.log(req.file);
        req.body.attachment = `./${req.file.path}`;
      }
      delete req.body.dest;
      const attrsUserUpdate = await attrsUserUpdateData(req, req.body);
      console.log(req.body);
      const result = await queryPUT(
        table.tb_m_jobs,
        attrsUserUpdate,
        `WHERE uuid = '${req.params.id}'`
      );
      response.success(res, "Success to edit job", result);
    } catch (error) {
      console.log(error);
      response.failed(res, error);
    }
  },
  deleteJob: async (req, res) => {
    try {
      let obj = {
        deleted_dt: moment().format().split("+")[0].split("T").join(" "),
        deleted_by: req.user.fullname,
      };
      let attrsUserUpdate = await attrsUserUpdateData(req, obj);
      const result = await queryPUT(
        table.tb_m_jobs,
        attrsUserUpdate,
        `WHERE uuid = '${req.params.id}'`
      );
      response.success(res, "Success to soft delete job", result);
    } catch (error) {
      console.log(error);
      response.failed(res, error);
    }
  },
};
