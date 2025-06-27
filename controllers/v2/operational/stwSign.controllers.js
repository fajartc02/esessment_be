const table = require("../../../config/table");
const {
  queryPOST,
  queryGET
} = require("../../../helpers/query");

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
      data.line_id = await uuidToId(table.tb_m_lines, 'line_id', data.line_id)
      await queryPOST(table.tb_r_stw_sign, data);

      response.success(res, 'Success to add sign');
    } catch (error) {
      console.log(error);
      response.error(res, 'Error to add sign');
    }
  },
  getSign: async (req, res) => {
    try {
      const query = req.query;
      // month, year, role_sign_sys, line_id
      const data = await queryGET(table.tb_r_stw_sign, `WHERE EXTRACT(MONTH FROM date_sign) = ${query.month} AND EXTRACT(YEAR FROM date_sign) = ${query.year} AND role_sign_sys = '${query.role_sign_sys}' AND line_id = ${await uuidToId(table.tb_m_lines, 'line_id', query.line_id)}`);
      // console.log(data)
      response.success(res, 'Success to get sign', data);
    } catch (error) {
      console.log(error);
      response.error(res, 'Error to get sign');
    }
  }
}