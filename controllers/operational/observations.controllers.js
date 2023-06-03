const table = require('../../config/table')
const { queryPOST, queryBulkPOST, queryCustom, queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const condDataNotDeleted = `deleted_dt IS NULL`

module.exports = {
    addScheduleObservation: async(req, res) => {
        try {
            req.body.pos_id = await uuidToId(table.tb_m_pos, 'pos_id', req.body.pos_id)
            req.body.job_id = await uuidToId(table.tb_m_jobs, 'job_id', req.body.job_id)
            req.body.group_id = await uuidToId(table.tb_m_groups, 'group_id', req.body.group_id)
            req.body.uuid = req.uuid()
            req.body.observation_id = await getLastIdData(table.tb_r_observations, 'observation_id') + 1

            const lastIdChecker = await getLastIdData(table.tb_r_obs_checker, 'obs_checker_id') + 1
            const checkers = req.body.checkers
            delete req.body.checkers
                // INSERT TO tb_r_observation
            const addAttrsUserInst = await attrsUserInsertData(req, req.body)
            const observation = await queryPOST(table.tb_r_observations, addAttrsUserInst)

            const obs_id = observation.rows[0].observation_id
            const mapCheckers = await checkers.map((checker, i) => {
                    checker.observation_id = obs_id
                    checker.uuid = req.uuid()
                    checker.obs_checker_id = lastIdChecker + i
                    return checker
                })
                // INSERT TO tb_r_obs_checker
            await queryBulkPOST(table.tb_r_obs_checker, mapCheckers)
            response.success(res, 'Success to add schedule observation', observation.rows)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to add schedule observation')
        }
    },
    getScheduleObservations: async(req, res) => {
        try {
            let observations = await queryCustom(`
                SELECT 
                    tro.uuid as observation_id,
                    tmp.pos_nm,
                    tmm.machine_nm,
                    tmg.group_nm,
                    tmj.uuid as job_id,
                    tmjt.job_type_nm,
                    tmjt.colors as job_type_color,
                    member_nm,
                    tro.plan_check_dt,
                    tro.actual_check_dt
                FROM ${table.tb_r_observations} tro
                JOIN ${table.tb_m_pos} tmp
                    ON tro.pos_id = tmp.pos_id
                JOIN ${table.tb_m_groups} tmg
                    ON tro.group_id = tmg.group_id
                JOIN ${table.tb_m_jobs} tmj
                    ON tro.job_id = tmj.job_id
                JOIN ${table.tb_m_machines} tmm
                    ON tmj.machine_id = tmm.machine_id
                JOIN ${table.tb_m_job_types} tmjt
                    ON tmj.job_type_id = tmjt.job_type_id
                WHERE 
                    ${'tro.' + condDataNotDeleted}
            `)
            let mapObs = observations.rows.map(async obser => {
                let obserId = await uuidToId(table.tb_r_observations, 'observation_id', obser.observation_id)
                obser.checkers = await queryGET(table.tb_r_obs_checker, `WHERE observation_id = ${obserId}`, ['uuid as obs_checker_id', 'checker_nm'])
                return obser
            })
            let waitData = await Promise.all(mapObs)
            response.success(res, 'Success to get schedule observation', waitData)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get schedule observation')
        }
    },
    getSummaryObservations: async(req, res) => {
        try {
            const summaryDelay = await queryCustom(`
                SELECT 
                    COUNT(uuid)
                FROM ${table.tb_r_observations}
                WHERE actual_check_dt IS NOT NULL
            `)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to add schedule observation')
        }
    }
}