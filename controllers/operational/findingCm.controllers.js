const table = require("../../config/table");
const {
    queryPOST,
    queryCustom,
    queryGET,
    queryPUT,
} = require("../../helpers/query");
const response = require("../../helpers/response");

const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const addAttrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");

const queryCondExacOpAnd = require("../../helpers/conditionsQuery");
const removeFileIfExist = require("../../helpers/removeFileIfExist");
const uuidToId = require("../../helpers/uuidToId");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");
const condDataNotDeleted = `WHERE deleted_dt IS NULL AND `;

module.exports = {
    getFindingCm: async(req, res) => {
        try {
            let { start_date, end_date, line_id, limit, currentPage } = req.query;
            let qLimit = ``;
            let qOffset =
                limit != -1 && limit && currentPage > 1 ?
                `OFFSET ${limit * (currentPage - 1)}` :
                ``;
            if (limit != -1 && limit) qLimit = `LIMIT ${limit}`;
            let conditions = queryCondExacOpAnd(req.query, "finding_date");
            let findingCmData = await queryGET(
                table.v_finding_list,
                `${condDataNotDeleted} ${conditions} ORDER BY finding_date DESC  ${qLimit} ${qOffset}`
            );
            // current_page
            // total_page
            // total_data
            // limit
            let qCountTotal = `SELECT 
            count(finding_id) as total_page
        FROM ${table.v_finding_list}
        ${condDataNotDeleted}
        ${conditions}`;
            let total_page = await queryCustom(qCountTotal);
            let totalPage = await total_page.rows[0].total_page;
            if (findingCmData.length > 0) {
                findingCmData[0].total_page = +totalPage > 0 ? Math.ceil(totalPage / +limit) : 1;
                findingCmData[0].limit = +limit;
                findingCmData[0].total_data = +totalPage;
                findingCmData[0].current_page = +currentPage > 0 ? +currentPage : 1;
            }

            response.success(res, "Success to get findingCm list", findingCmData);
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to get findingCm list");
        }
    },
    uploadPinksheet: async(req, res) => {
        try {
            if (req.file) {
                req.body.file_pinksheet = `./${req.file.path}`;
            }

            let finding_id = `${await uuidToId(
        table.tb_r_findings,
        "finding_id",
        req.body.finding_id
      )}`;
            if (
                req.body.before_path != null &&
                req.body.before_path != "null" &&
                req.body.before_path
            ) {
                removeFileIfExist(req.body.before_path);
            }

            delete req.body.dest;
            delete req.body.finding_id;
            delete req.body.before_path;

            // Update tb_r_finding SET file_pinksheet = req.file.path
            await queryPUT(
                table.tb_r_findings,
                req.body,
                `WHERE finding_id = '${finding_id}'`
            );
            response.success(
                res,
                "Success to upload pinksheet",
                req.body.file_pinksheet
            );
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to upload kaizen report");
        }
    },
    uploadImageFinding: async(req, res) => {
        try {
            let resFile = `./${req.file.path}`;
            if (
                req.body.before_path != null &&
                req.body.before_path != "null" &&
                req.body.before_path
            ) {
                removeFileIfExist(req.body.before_path);
                response.success(res, "success to edit file", resFile);
            } else {
                response.success(res, "success to upload file", resFile);
            }
        } catch (error) {
            response.failed(res, "Error to Upload finding Image");
        }
    },
    signFinding: async(req, res) => {
        try {
            let finding_id = await uuidToId(
                table.tb_r_findings,
                "finding_id",
                req.body.finding_id
            );
            let objRes = req.body;
            let attrsUpdateUserFinding = await attrsUserUpdateData(req, req.body);
            // console.log(attrsUpdateUserFinding);
            delete req.body.finding_id;
            await queryPUT(
                table.tb_r_findings,
                attrsUpdateUserFinding,
                `WHERE finding_id = '${finding_id}'`
            );
            response.success(res, "success to sign finding", objRes);
        } catch (error) {
            response.failed(res, "Error to sign finding");
        }
    },
    editFindingCm: async(req, res) => {
        try {
            let finding_id = await uuidToId(
                table.tb_r_findings,
                "finding_id",
                req.params.id
            );

            let findingsData = {
                ...req.body,
                line_id: await uuidToId(table.tb_m_lines, "line_id", req.body.line_id),
                category_id: await uuidToId(
                    table.tb_m_categories,
                    "category_id",
                    req.body.category_id
                ),
                factor_id: await uuidToId(
                    table.tb_m_factors,
                    "factor_id",
                    req.body.factor_id
                ),
                cm_pic_id: await uuidToId(
                    table.tb_m_users,
                    "user_id",
                    req.body.cm_pic_id
                ),
                cm_result_factor_id: await uuidToId(
                    table.tb_m_factors,
                    "factor_id",
                    req.body.cm_result_factor_id
                ),
            };

            let attrsUpdateUserFinding = await attrsUserUpdateData(req, findingsData);
            await queryPUT(
                table.tb_r_findings,
                attrsUpdateUserFinding,
                `WHERE finding_id = '${finding_id}'`
            );

            response.success(res, "Success to EDIT Finding");
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to edit finding");
        }
    },
    deleteFinding: async(req, res) => {
        try {
            let finding_id = await uuidToId(
                table.tb_r_findings,
                "finding_id",
                req.params.id
            );
            let obj = {
                deleted_dt: "CURRENT_TIMESTAMP",
                deleted_by: req.user.fullname,
            };

            await queryPUT(
                table.tb_r_findings,
                obj,
                `WHERE finding_id = '${finding_id}'`
            );
            response.success(res, "Success to DELETE finding");
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to DELETE finding");
        }
    },
};