const security = require("../../helpers/security");
const auth = require("../../helpers/auth");
const response = require("../../helpers/response");
const table = require("../../config/table");
const idToUuid = require("../../helpers/idToUuid");
const { database } = require("../../config/database");

module.exports = {
  login: async (req, res) => {
    try {
      // Parameterized query: $1 prevents SQL injection on noreg input
      const queryResult = await database.query(
        `SELECT * FROM ${table.tb_m_users} WHERE noreg = $1 AND is_activated = true AND deleted_dt IS NULL`,
        [req.body.noreg]
      );

      const result = queryResult.rows;

      if (result.length > 0) {
        let hashPassword = result[0].password;
        const decryptPass = await security.decryptPassword(req.body.password, hashPassword);

        if (decryptPass) {
          result[0].line_id = await idToUuid(
            table.tb_m_lines,
            "line_id",
            result[0].line_id
          );
          result[0].group_id = await idToUuid(
            table.tb_m_groups,
            "group_id",
            result[0].group_id
          );

          let token = await auth.generateToken({
            name: result[0].name,
            noreg: result[0].noreg,
          });

          response.success(res, "Success to Login", {
            data: result[0],
            token,
          });
        } else {
          // Password salah
          throw false;
        }
      } else {
        // User not found in DB
        throw null;
      }
    } catch (error) {
      console.log(error);
      response.notAllowed(
        res,
        error == null || error == false
          ? error == false
            ? "Noreg / Password Salah"
            : "User belum terdaftar / User belum di aktivasi, silahkan register / kontak admin"
          : error
      );
    }
  },
};
