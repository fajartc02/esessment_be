const table = require("../../config/table");
const {
  queryExcelPost,
  queryPUT,
  queryExcelPut,
  queryCustom,
  queryDELETE,
} = require("../../helpers/query");
const getLastIdData = require("../../helpers/getLastIdData");
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const uuidToIdNew = require("../../helpers/uuidToIdNew");
const response = require("../../helpers/response");
const { v4: uuidv4 } = require("uuid");

module.exports = {
postWras: async (req, res) => {
  try {
    // === Generate ID baru ===
   let lastId = await getLastIdData(table.tb_m_wras, "wras_id");
let idLast = lastId + 1;

    // === Parse file dari FE (kalau ada) ===
    let filePayload = req.body.file;
    if (typeof filePayload === "string") {
      filePayload = JSON.parse(filePayload);
    }

    // === Build body untuk insert ===
    const insertBody = {
      wras_id: idLast,
      plant: await uuidToIdNew(table.tb_m_plants, "plant_nm", req.body.plant, ), 
      shop: await uuidToIdNew(table.tb_m_shop, "shop_nm", req.body.shop, ),
      line: await uuidToIdNew(table.tb_m_lines, "line_nm", req.body.line, ),
      pos: await uuidToIdNew(table.tb_m_pos, "pos_nm", req.body.pos, ),
      sop: await uuidToIdNew(table.tb_m_jobs, "job_nm", req.body.sop, ),
      file: filePayload ? JSON.stringify(filePayload) : null,
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
    const sql = `
      SELECT *
      FROM ${table.tb_m_wras}
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
      const { file } = req.body;

      if (!id) {
        return response.failed(res, "WRAS id wajib ada");
      }
      if (!file) {
        return response.failed(res, "Field 'file' wajib diisi");
      }

      const updateBody = {
        file: JSON.stringify(file),
      };

     
      const result = await queryExcelPut(table.tb_m_wras, updateBody, {
        wras_id: id,
      });

     

      return response.success(res, "Success update WRAS");
    } catch (error) {
      console.error(error);
      return response.failed(res, error.message || error);
    }
  },
  deleteWras: async (req, res) => {
  try {
    
    // update record berdasarkan uuid
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
