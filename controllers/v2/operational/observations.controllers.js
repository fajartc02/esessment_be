const table = require("../../../config/table");
const {
  queryPOST,
  queryBulkPOST,
  queryTransaction,
  queryPostTransaction,
} = require("../../../helpers/query");

const response = require("../../../helpers/response");
const getLastIdData = require("../../../helpers/getLastIdData");
const uuidToId = require("../../../helpers/uuidToId");

const attrsUserInsertData = require("../../../helpers/addAttrsUserInsertData");

const moment = require("moment");
const getLastIdDataNew = require("../../../helpers/getLastIdDataNew");
const uuidToIdV2 = require("../../../helpers/uuidToIdV2");

module.exports = {
  addScheduleObservationV2: async (req, res) => {
    try {
      await queryTransaction(async (db) => {
        req.body.pos_id = await uuidToIdV2(
          table.tb_m_pos,
          "pos_id",
          req.body.pos_id,
          db
        );
        req.body.job_id = await uuidToIdV2(
          table.tb_m_jobs,
          "job_id",
          req.body.job_id,
          db
        );
        req.body.group_id = await uuidToIdV2(
          table.tb_m_groups,
          "group_id",
          req.body.group_id,
          db
        );
        req.body.uuid = req.uuid();
        req.body.observation_id =
          getLastIdDataNew(table.tb_r_observations, "observation_id", 1)

        const checkers = req.body.checkers;
        // INSERT TO tb_r_observation
        delete req.body.checkers;
        const addAttrsUserInst = await attrsUserInsertData(req, req.body);
        const observation = await queryPostTransaction(
          db,
          table.tb_r_observations,
          addAttrsUserInst,
        );

        // console.log(addAttrsUserInst)
        // console.log(observation, 'observation')
        const obs_id = observation.rows[0].observation_id;
        // INSERT TO tb_r_obs_checker
        await checkers.map(async (checker, i) => {
          const lastIdChecker = getLastIdDataNew(table.tb_r_obs_checker, "obs_checker_id", i + 1);
          checker.obs_checker_id = lastIdChecker;
          console.log({
            uuid: req.uuid(),
            observation_id: obs_id,
            obs_checker_id: lastIdChecker,
            checker_nm: checker
          })
          await queryPostTransaction(db, table.tb_r_obs_checker, {
            uuid: req.uuid(),
            observation_id: obs_id,
            obs_checker_id: lastIdChecker,
            checker_nm: checker
          })
          return true
        })

        response.success(
          res,
          "Success to add schedule observation",
        );
      })
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to add schedule observation");
    }
  },
};
