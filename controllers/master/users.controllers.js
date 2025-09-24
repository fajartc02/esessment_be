const table = require("../../config/table");
const { queryPOST, queryPUT, queryGET } = require("../../helpers/query");

const response = require("../../helpers/response");
const getLastIdData = require("../../helpers/getLastIdData");
const uuidToId = require("../../helpers/uuidToId");
const idToUuid = require("../../helpers/idToUuid");
const security = require("../../helpers/security");
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");
const condDataNotDeleted = `deleted_dt IS NULL`;

const moment = require("moment");

module.exports = {
  getUsersOpts: async (req, res) => {
    try {
      let { id, line_id, group_id, isForm } = req.query;
      let containerQuery = ``;
      if (id && id != -1 && id != "null") {
        let idUser = await uuidToId(table.tb_m_users, "user_id", id);
        containerQuery += ` AND user_id = ${idUser}`;
      }
      if (line_id && line_id != -1 && line_id != "null") {
        let idLine = await uuidToId(table.tb_m_lines, "line_id", line_id);
        containerQuery += ` AND line_id = ${idLine}`;
      }
      if (group_id && group_id != -1 && group_id != "null") {
        let idGroup = await uuidToId(table.tb_m_groups, "group_id", group_id);
        containerQuery += ` AND group_id = ${idGroup}`;
      }
      let cols = [
        "uuid as id",
        "noreg",
        "fullname as text",
        "created_by",
        "created_dt",
        "role",
      ];
      if (isForm) {
        cols = [
          "uuid as id",
          "line_id",
          "group_id",
          "noreg",
          "fullname",
          "password",
          "phone_number",
          "role",
        ];
        const users = await queryGET(
          table.tb_m_users,
          `WHERE ${condDataNotDeleted}${containerQuery} ORDER BY fullname ASC`,
          cols
        );
        users[0].line_id = await idToUuid(
          table.tb_m_lines,
          "line_id",
          users[0].line_id
        );
        users[0].group_id = await idToUuid(
          table.tb_m_groups,
          "group_id",
          users[0].group_id
        );
        console.log(users);
        response.success(res, "Success to get users", users);
        return;
      }
      const users = await queryGET(
        table.tb_m_users,
        `WHERE ${condDataNotDeleted}${containerQuery} ORDER BY fullname ASC`,
        cols
      );

      response.success(res, "Success to get users", users);
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to get users");
    }
  },
  postUser: async (req, res) => {
    try {
      let idLast = (await getLastIdData(table.tb_m_users, "user_id")) + 1;
      req.body.user_id = idLast;
      req.body.uuid = req.uuid();
      let unreadPassword = await security.encryptPassword(req.body.password);
      req.body.password = unreadPassword;

      let idLine = await uuidToId(
        table.tb_m_lines,
        "line_id",
        req.body.line_id
      );
      let idGroup = await uuidToId(
        table.tb_m_groups,
        "group_id",
        req.body.group_id
      );
      req.body.group_id = idGroup;
      req.body.line_id = idLine;

      delete req.body.id;
      delete req.body.text;
      req.body.is_activated = true;

      let attrsUserInsert = await attrsUserInsertData(req, req.body);
      const result = await queryPOST(table.tb_m_users, attrsUserInsert);
      response.success(res, "Success to add user", result);
    } catch (error) {
      console.log(error);
      response.failed(res, error);
    }
  },
  editUser: async (req, res) => {
    try {
      console.log(req.body);
      let id = await uuidToId(table.tb_m_users, "user_id", req.params.id);
      let idLine = await uuidToId(
        table.tb_m_lines,
        "line_id",
        req.body.line_id
      );
      let idGroup = await uuidToId(
        table.tb_m_groups,
        "group_id",
        req.body.group_id
      );
      req.body.line_id = idLine;
      req.body.group_id = idGroup;
      // let unreadPassword = await security.encryptPassword(req.body.password)
      // req.body.password = unreadPassword

      const attrsUserUpdate = await attrsUserUpdateData(req, req.body);
      const result = await queryPUT(
        table.tb_m_users,
        attrsUserUpdate,
        `WHERE user_id = '${id}'`
      );
      response.success(res, "Success to edit user", result);
    } catch (error) {
      console.log(error);
      response.failed(res, error);
    }
  },
  deleteUser: async (req, res) => {
    try {
      let obj = {
        deleted_dt: moment().format().split("+")[0].split("T").join(" "),
        deleted_by: req.user.fullname,
      };
      let attrsUserUpdate = await attrsUserUpdateData(req, obj);
      const result = await queryPUT(
        table.tb_m_users,
        attrsUserUpdate,
        `WHERE uuid = '${req.params.id}'`
      );
      response.success(res, "Success to soft delete user", result);
    } catch (error) {
      console.log(error);
      response.failed(res, error);
    }
  },
  editRole: async (req, res) => {
    try {
      const id = await uuidToId(table.tb_m_users, "user_id", req.params.id);
      const attrsUserUpdate = await attrsUserUpdateData(req, req.body);
      const result = await queryPUT(
        table.tb_m_users,
        attrsUserUpdate,
        `WHERE user_id = '${id}'`
      );
      response.success(res, "Role updated", result);
    } catch (error) {
      console.error(error);
      response.failed(res, error.message);
    }
  },
   editPass: async (req, res) => {
    try {
      const id = await uuidToId(table.tb_m_users, "user_id", req.params.id);
         let unreadPassword = await security.encryptPassword(req.body.password);
      req.body.password = unreadPassword;
      const attrsUserUpdate = await attrsUserUpdateData(req, req.body);
      const result = await queryPUT(
        table.tb_m_users,
        attrsUserUpdate,
        `WHERE user_id = '${id}'`
      );
      response.success(res, "Password updated", result);
    } catch (error) {
      console.error(error);
      response.failed(res, error.message);
    }
  },
};
