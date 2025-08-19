const table = require("../../config/table");
const {
    queryPOST,
    queryBulkPOST,
    queryCustom,
    queryGET,
    queryPUT,
    queryTransaction,
    queryPostTransaction,
    queryDELETE,
} = require("../../helpers/query");

const response = require("../../helpers/response");
const getLastIdData = require("../../helpers/getLastIdData");
const uuidToId = require("../../helpers/uuidToId");
const idToUuid = require("../../helpers/idToUuid");

const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const addAttrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");
const condDataNotDeleted = `deleted_dt IS NULL`;

const moment = require("moment");
const removeFileIfExist = require("../../helpers/removeFileIfExist");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");
const { default: axios } = require("axios");
const uuidToAbnormalityID = require("../../helpers/uuidToAbnormalityId");

module.exports = {
    editObservation: async (req, res) => {
        try {
            const observation_id = req.body.observation_id;
            if (req.body.group_id) {
                req.body.group_id = await uuidToId(
                    table.tb_m_groups,
                    "group_id",
                    req.body.group_id
                );
            }

            delete req.body.observation_id;
            let attrsUserInsert = await attrsUserInsertData(req, req.body);
            await queryPUT(
                table.tb_r_observations,
                attrsUserInsert,
                `WHERE uuid = '${observation_id}'`
            );
            response.success(res, "Success to edit observation");
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to get schedule observation");
        }
    },
    addObservationCheck: async (req, res) => {
        try {
            req.body.observation_id = await uuidToId(
                table.tb_r_observations,
                "observation_id",
                req.body.observation_id
            );
            req.body.uuid = req.uuid();
            const lastIdResCheck =
                (await getLastIdData(table.tb_r_obs_results, "obs_result_id")) + 1;
            req.body.obs_result_id = lastIdResCheck;
            req.body.category_id = await uuidToId(
                table.tb_m_categories,
                "category_id",
                req.body.category_id
            );
            console.log(req.body);
            req.body.judgment_id = await uuidToId(
                table.tb_m_judgments,
                "judgment_id",
                req.body.judgment_id
            );
            console.log(req.body);
            const addAttrsUserInst = await attrsUserInsertData(req, req.body);
            // console.log(addAttrsUserInst);
            await queryPOST(table.tb_r_obs_results, addAttrsUserInst);
            response.success(res, "success to add check observation");
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to add check observation");
        }
    },
    addObservationCheckV2: async (req, res) => {
        try {
            req.body.observation_id = await uuidToId(
                table.tb_r_observations,
                "observation_id",
                req.body.observation_id
            );
            req.body.uuid = req.uuid();
            const lastIdResCheck =
                (await getLastIdData(table.tb_r_obs_results, "obs_result_id")) + 1;
            req.body.obs_result_id = lastIdResCheck;
            req.body.category_id = await uuidToId(
                table.tb_m_categories,
                "category_id",
                req.body.category_id
            );
            console.log(req.body);
            req.body.judgment_id = await uuidToId(
                table.tb_m_judgments,
                "judgment_id",
                req.body.judgment_id
            );
            console.log(req.body);
            const addAttrsUserInst = await attrsUserInsertData(req, req.body);
            // console.log(addAttrsUserInst);
            await queryPOST(table.tb_r_obs_results, addAttrsUserInst);
            response.success(res, "success to add check observation");
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to add check observation");
        }
    },
    updateObservationCheck: async (req, res) => {
        try {
            const obs_result_id = req.params.obs_result_id
            req.body.observation_id = await uuidToId(
                table.tb_r_observations,
                "observation_id",
                req.body.observation_id
            );
            req.body.uuid = req.uuid();
            // const lastIdResCheck =
            //     (await getLastIdData(table.tb_r_obs_results, "obs_result_id")) + 1;
            req.body.obs_result_id = obs_result_id;
            req.body.category_id = await uuidToId(
                table.tb_m_categories,
                "category_id",
                req.body.category_id
            );
            console.log(req.body);
            req.body.judgment_id = await uuidToId(
                table.tb_m_judgments,
                "judgment_id",
                req.body.judgment_id
            );

            const judgmentData = await queryGET(table.tb_m_judgments, `WHERE judgment_id = '${req.body.judgment_id}'`);
            // console.log(judgmentData, 'judgmentsData');
            if (!judgmentData[0].is_abnormal) {
                const resultFindingData = await queryGET(table.tb_r_result_findings, `WHERE obs_result_id = '${obs_result_id}'`);
                const isFindingDataBeforeAvail = resultFindingData.length > 0;
                if (isFindingDataBeforeAvail) {
                    // console.log(resultFindingData)
                    resultFindingData.forEach(async (resultFinding) => {
                        await queryDELETE(table.tb_r_findings, `WHERE finding_obs_id = '${resultFinding.result_finding_id}'`);
                    });
                    // const findingData = await queryGET(table.tb_r_findings, `WHERE finding_obs_id = '${resultFindingData[0].finding_id}'`);
                    await queryDELETE(table.tb_r_result_findings, `WHERE obs_result_id = '${obs_result_id}'`);
                }
            }
            const updateUserDataChanged = await attrsUserUpdateData(req, req.body);
            console.log(updateUserDataChanged, 'updateUserDataChanged');
            await queryPUT(table.tb_r_obs_results, updateUserDataChanged, `WHERE obs_result_id = '${obs_result_id}'`);
            response.success(res, "success to add check observation");
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to add check observation");
        }
    },
    addFindingObsCheck: async (req, res) => {
        try {
            // let selectFindingData = await req.body.findings.find(async(finding) => await uuidToId(table.tb_m_categories, 'category_id', finding.category_id) == resCheckData.category_id)
            // let obs_result_id = resCheckData.obs_result_id
            // selectFindingData.line_id = await uuidToId(table.tb_m_lines, 'line_id', selectFindingData.line_id) ?? null
            // selectFindingData.cm_pic_id = await uuidToId(table.tb_m_users, 'user_id', selectFindingData.cm_pic_id.pic_id) ?? null
            // selectFindingData.factor_id = await uuidToId(table.tb_m_factors, 'factor_id', selectFindingData.factor_id) ?? null
            // selectFindingData.cm_result_factor_id = await uuidToId(table.tb_m_factors, 'factor_id', selectFindingData.cm_result_factor_id) ?? null

            const transaction = await queryTransaction(async (db) => {
                // PROCESS FOR ADD ABNORMALITY DATA (WITHOUT TOKEN)
                if (req.body.department_id) {

                    // pic = departement terkait (OK) | ready FE {department_id}
                    // tanoko/status = evaluation (OK in 4S | cm_judg in STW [BE Process]) {cm_judg}
                    // line (OK) | ready FE {line_id}
                    // problemLoc {finding_location}
                    // Shift = userData.group_id (OK) | [BE Process] {pic_id}
                    // Category (auto set with Ergonomic & Difficulty Job) [id: 4] BE Process
                    // Problem = {finding_desc}
                    // Countermeasure = {cm_desc}
                    // problem date = finding_date
                    // Countermeasure Date {cm_end_plan_date}
                    const getGroupIdUser = await uuidToAbnormalityID(table.tb_m_users, 'group_id', req.body.cm_pic_id.pic_id, db)
                    const getGroupAbnormalityID = await uuidToAbnormalityID(table.tb_m_groups, 'abnormality_id', getGroupIdUser, db, 'group_id')
                    console.log(getGroupIdUser, 'getGroupIdUser', getGroupAbnormalityID)
                    const responseAdd = await axios.post(`https://mt-system.id/abnormality/be/problems/add`, {
                        problem_date: moment(req.body.finding_date).format('YYYY-MM-DD'),
                        countermeasure_date: moment(req.body.cm_end_plan_date).format('YYYY-MM-DD'),
                        problem_desc: req.body.finding_desc,
                        line_id: await uuidToAbnormalityID(table.tb_m_lines, 'abnormality_id', req.body.line_id, db),
                        shift_id: getGroupAbnormalityID,
                        department_id: await uuidToAbnormalityID(table.tb_m_system, 'abnormality_id', req.body.department_id, db),
                        category_id: 4, // Ergonomic & Difficulty Job
                        countermeasure: req.body.cm_desc,
                        status_id: req.body.cm_judg ? 4 : 1,
                        problem_loc: req.body.finding_location
                    })
                    console.log(responseAdd.response, 'responseAdd')
                    delete req.body.department_id
                }
                console.log(req.body, 'BEFORE');
                delete req.body.department_id
                req.body.category_id = req.body.category_id ?
                    `(select category_id from ${table.tb_m_categories} where uuid = '${req.body.category_id}')` :
                    null;
                req.body.factor_id = req.body.factor_id ?
                    `(select factor_id from ${table.tb_m_factors} where uuid = '${req.body.factor_id}')` :
                    null;
                req.body.line_id = req.body.line_id ?
                    `(select line_id from ${table.tb_m_lines} where uuid = '${req.body.line_id}')` :
                    null;
                req.body.cm_pic_id = req.body.cm_pic_id ?
                    `(select user_id from ${table.tb_m_users} where uuid = '${req.body.cm_pic_id.pic_id}')` :
                    null;
                req.body.cm_result_factor_id = req.body.cm_result_factor_id ?
                    `(select factor_id from ${table.tb_m_factors} where uuid = '${req.body.cm_result_factor_id}')` :
                    null;
                req.body.pic_supervisor_id = req.body.pic_supervisor_id ?
                    `(select user_id from ${table.tb_m_users} where uuid = '${req.body.pic_supervisor_id.pic_id}')` :
                    null;
                console.log(req.body);

                let resultFindingData = {
                    result_finding_id: `(select (result_finding_id + 1) from ${table.tb_r_result_findings} order by result_finding_id desc limit 1)`,
                    uuid: req.uuid(),
                    obs_result_id: req.body.obs_result_id,
                };
                // INSERT TO RESULT FINDING (GET OBS FINDING ID)
                let resultFindingResponse = await queryPostTransaction(
                    db,
                    table.tb_r_result_findings,
                    resultFindingData
                );
                const finding_obs_id = resultFindingResponse.rows[0].result_finding_id;
                console.log(finding_obs_id);
                delete req.body.obs_result_id;
                // INSERT TO tb_r_findings
                console.log(req.body.cm_judg);
                req.body.cm_judg = req.body.cm_judg ? "1" : "0";
                let findingData = {
                    ...req.body,
                    finding_obs_id,
                    finding_id: `(select (finding_id + 1) from ${table.tb_r_findings} order by finding_id desc limit 1)`,
                    uuid: req.uuid(),
                    is_need_improvement: req.body.is_need_improvement,
                    is_change_sop: req.body.is_change_sop,
                };
                const attrsUserInsert = await attrsUserInsertData(req, findingData);

                return await queryPostTransaction(
                    db,
                    table.tb_r_findings,
                    attrsUserInsert
                );
            });
            response.success(
                res,
                "Success to add finding check observation",
                transaction
            );
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to add finding check observation");
        }
    },
    addVideoObservation: async (req, res) => {
        try {
            let resFile = `./${req.file.path}`;
            if (
                req.body.before_path != null &&
                req.body.before_path != "null" &&
                req.body.before_path
            ) {
                console.log("req.body.before_path", req.body.before_path);

                const prevPath = req.body.before_path.split("=")[1];
                await queryPUT(
                    table.tb_r_observations, { video: resFile },
                    `WHERE uuid = '${req.params.observation_id}'`
                );
                removeFileIfExist(prevPath);
                response.success(res, "success to add observation file", resFile);
            } else {
                await queryPUT(
                    table.tb_r_observations, { video: resFile },
                    `WHERE uuid = '${req.params.observation_id}'`
                );
                response.success(res, "success to add observation file", resFile);
            }
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to add video observation");
        }
    },
};