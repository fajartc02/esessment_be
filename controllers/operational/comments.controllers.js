const table = require("../../config/table")
const { queryPUT, queryGET, queryCustom, queryPOST, queryTransaction, queryPostTransaction, queryPutTransaction } = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")

const moment = require("moment")
const { uuid } = require("uuidv4")
const containerMock = [
  {
    name: 'Jhone Doe',
    noreg: '2',
    comments: 'test comments',
    created_dt: '2022-09-01 00:00:00',
    observation_id: '1',
  },
  {
    name: 'Jhone Doe',
    noreg: '2',
    comments: 'test comments 12',
    created_dt: '2022-09-01 00:00:00',
    observation_id: '1',
  },
  {
    name: 'Jhone Doe',
    noreg: '2',
    comments: 'test comments',
    created_dt: '2022-09-01 00:00:00',
    observation_id: '1',
  },
  {
    name: 'Jhone Doe',
    noreg: '2',
    comments: 'test comments',
    created_dt: '2022-09-01 00:00:00',
    observation_id: '1',
  }
]

module.exports = {
  getComments: async (req, res) => {
    try {
      const { observation_id } = req.query;

      // =========================
      // ✅ WHITELIST PARAM
      // =========================
      const allowedParams = ['observation_id'];

      for (const key in req.query) {
        if (!allowedParams.includes(key)) {
          return response.failed(res, `Invalid param: ${key}`);
        }
      }

      // =========================
      // ✅ HELPER VALIDASI
      // =========================
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;
      const hasInjection = (val) =>
        /('|--|;|\|\||\bOR\b|\bAND\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b)/i.test(val);

      // =========================
      // ✅ VALIDASI observation_id
      // =========================
      if (
        !observation_id ||
        !uuidRegex.test(observation_id) ||
        hasInjection(observation_id)
      ) {
        return response.failed(res, "Invalid observation_id");
      }

      // =========================
      // ✅ QUERY (AMAN)
      // =========================
      const responseData = await queryGET(
        table.tb_r_observations_comments,
        `WHERE observation_id = (
            SELECT observation_id 
            FROM tb_r_observations 
            WHERE uuid = '${observation_id}'
          )`,
        ['uuid as id', 'comments', 'created_dt', 'name', 'noreg']
      );

      response.success(
        res,
        `Success to get comments with id: ${observation_id}`,
        responseData
      );

    } catch (error) {
      console.log(error);
      response.failed(res, "Error to get comments");
    }
  },
  getComments4S: async (req, res) => {
    try {
      const { sub_schedule_id } = req.query
      const responseData = await queryGET(
        table.tb_r_4s_comments,
        `WHERE sub_schedule_id = (select sub_schedule_id from tb_r_4s_sub_schedules WHERE uuid = '${sub_schedule_id}')`,
        ['uuid as id', 'comments', 'created_dt', 'name', 'noreg'],
      )
      response.success(res, `Success to get comments with id: ${sub_schedule_id}`, responseData)
    } catch (error) {
      console.log(error)
      response.failed(res, error)
    }
  },
  postComments: async (req, res) => {
    try {
      // ==========================================
      // ✅ 1. ANTI MASS ASSIGNMENT: STRIKT CHECK
      // ==========================================
      
      // Daftar field yang BENAR-BENAR diizinkan dari client
      const allowedFields = ['observation_id', 'comments', 'created_dt', 'name', 'noreg'];
      
      // Ambil semua key yang dikirim oleh user di body
      const incomingFields = Object.keys(req.body);

      // Periksa apakah ada key di req.body yang TIDAK terdaftar di allowedFields
      const isInvalidPayload = incomingFields.some(field => !allowedFields.includes(field));

      if (isInvalidPayload) {
        // Jika ada 'isadmin', 'role', dll, maka akan masuk ke sini
        return response.failed(res, "Invalid some field");
      }

      // Ekstrak data setelah dipastikan payload bersih
      let { observation_id, comments, created_dt, name, noreg } = req.body;
      const noreg_pic = req.user.noreg; // Ambil dari session asli

      // ==========================================
      // ✅ 2. VALIDASI UUID & SQL INJECTION
      // ==========================================
      if (!observation_id) return response.failed(res, "observation_id required");

      const uuidRegex = /^[0-9a-fA-F-]{36}$/;
      if (!uuidRegex.test(observation_id)) return response.failed(res, "Invalid format");

      const hasInjection = (val) => /('|--|;|\|\||\bOR\b|\bAND\b|=)/i.test(val);
      if (hasInjection(comments) || hasInjection(name)) {
        return response.failed(res, "Invalid input detected");
      }

      // Cek keberadaan observasi
      const obsData = await queryGET(
        table.tb_r_observations,
        `WHERE uuid = '${observation_id}'`,
        ['observation_id']
      );

      if (!obsData || obsData.length === 0) return response.failed(res, "Observation not found");
      const obsId = obsData[0].observation_id;

      // ==========================================
      // ✅ 3. KONSTRUKSI DATA CLEAN (FINAL)
      // ==========================================
      const finalData = {
        id: `(select COALESCE(MAX(id), 0) + 1 FROM tb_r_observations_comments)`,
        uuid: req.uuid(),
        observation_id: obsId,
        comments: String(comments).trim(),
        name: String(name).trim(),
        noreg: String(noreg).trim(),
        created_dt: created_dt || moment().format("YYYY-MM-DD HH:mm:ss"),
        created_by: noreg_pic
      };

      // Kirim data ke database
      await queryPOST(table.tb_r_observations_comments, finalData);

      response.success(res, "Success to post comments");

    } catch (error) {
      console.log(error);
      response.failed(res, "Internal error");
    }
  },
  postComments4S: async (req, res) => {
    try {
      req.body.created_by = req.user.noreg
      let { comments, sub_schedule_id, name, noreg, created_dt, created_by } = req.body
      const data = {
        id: `(select COALESCE(MAX(id), 0) + 1 FROM tb_r_4s_comments)`,
        uuid: req.uuid(),
        comments,
        sub_schedule_id: `(select sub_schedule_id from tb_r_4s_sub_schedules WHERE uuid = '${sub_schedule_id}')`,
        name,
        noreg,
        created_dt,
        created_by
      }
      const responseData = await queryPOST(table.tb_r_4s_comments, data)
      // containerMock.push(req.body)
      response.success(res, 'Success to post comments')
    } catch (error) {
      console.log(error)
      response.failed(res, 'Internal error')
    }
  }
}
