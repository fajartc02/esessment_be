const table = require("../../config/table");
const {
  queryExcelPost,
  queryPOST,
  queryGet,
  queryExcelPut,
  queryCustom,
} = require("../../helpers/query");
const getLastIdData = require("../../helpers/getLastIdData");
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const uuidToId = require("../../helpers/uuidToId");
const response = require("../../helpers/response");
const { v4: uuidv4 } = require("uuid");

module.exports = {
postWras: async (req, res) => {
  try {
    let idLast = (await getLastIdData(table.tb_m_wras, "wras_id")) + 1;
    req.body.wras_id = idLast;
    req.body.uuid = req.uuid();

    // === Parse file dari FE ===
    let filePayload = req.body.file;
    if (typeof filePayload === "string") {
      filePayload = JSON.parse(filePayload);
    }
    const config = filePayload?.[0]?.config?.columnlen || {};

    // Mapping UUID → nama pakai helper
    const plantNm = await uuidToName(table.tb_m_plants, "plant_nm", config.plant);
    const shopNm  = await uuidToName(table.tb_m_shop, "shop_nm", config.shop);
    const lineNm  = await uuidToName(table.tb_m_lines, "line_nm", config.line);
    const posNm   = await uuidToName(table.tb_m_pos, "pos_nm", config.pos);
    const sopNm   = await uuidToName(table.tb_m_jobs, "job_nm", config.sop);

    // === Build insert body ===
    const insertBody = {
      wras_id: req.body.wras_id,
      uuid: req.body.uuid,
      plant: plantNm,
      shop: shopNm,
      line: lineNm,
      pos: posNm,
      sop: sopNm,
      file: JSON.stringify(filePayload),
    };

    // Insert ke DB
    const result = await queryExcelPost(table.tb_m_wras, insertBody);

    response.success(res, "Success to add WRAS", result);
  } catch (error) {
    console.error(error);
    response.failed(res, error.message || error);
  }
},

  getWras: async (req, res) => {
    try {
      const sql = `
        SELECT wras_id, file
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

      if (result.rowCount === 0) {
        return response.failed(res, "Data tidak ditemukan");
      }

      return response.success(res, "Success update WRAS", result.rows[0]);
    } catch (error) {
      console.error(error);
      return response.failed(res, error.message || error);
    }
  },
};
