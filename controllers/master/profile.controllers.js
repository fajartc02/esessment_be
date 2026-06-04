const table = require("../../config/table");
const { queryPUT, queryGET } = require("../../helpers/query");
const response = require("../../helpers/response");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");

module.exports = {
  getProfile: async (req, res) => {
    try {
      const user = await queryGET(table.tb_m_users, `WHERE noreg = '${req.user.noreg}'`, [
        "noreg",
        "fullname",
        "role",
        "photo_url"
      ]);
      if (user.length > 0) {
        response.success(res, "Success to get profile", user[0]);
      } else {
        response.failed(res, "User not found");
      }
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to get profile");
    }
  },
  updateProfile: async (req, res) => {
    try {
      // Remove role from body to prevent unauthorized role change
      delete req.body.role;
      const attrsUserUpdate = await attrsUserUpdateData(req, req.body);
      const result = await queryPUT(
        table.tb_m_users,
        attrsUserUpdate,
        `WHERE uuid = '${req.user.uuid}'`
      );
      response.success(res, "Success to update profile", result);
    } catch (error) {
      console.log(error);
      response.failed(res, error);
    }
  },
  uploadPhoto: async (req, res) => {
    try {
      if (!req.file) {
        return response.failed(res, "No file uploaded");
      }
      // normalize path and remove ./ if it exists
      const photo_url = req.file.path.replace(/\\/g, "/").replace(/^\.\//, ""); 
      const attrsUserUpdate = await attrsUserUpdateData(req, { photo_url });
      await queryPUT(
        table.tb_m_users,
        attrsUserUpdate,
        `WHERE uuid = '${req.user.uuid}'`
      );
      response.success(res, "Success to upload photo", { photo_url });
    } catch (error) {
      console.log(error);
      response.failed(res, error);
    }
  }
};
