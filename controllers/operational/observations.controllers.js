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
            const { month, year, line } = req.query
            let whereCond = ``
            if (month && year) whereCond = `AND (EXTRACT(month from  tro.plan_check_dt), EXTRACT('year' from tro.plan_check_dt))=(${+month},${+year})`
            if (line != "0" && line) whereCond += ` AND tmm.line_id = ${await uuidToId(table.tb_m_lines, 'line_id', line)}`
            console.log(req.query);
            let observations = await queryCustom(`
                SELECT 
                    tro.uuid as observation_id,
                    tmp.uuid as pos_id,
                    tml.line_snm,
                    tmp.pos_nm,
                    tmm.machine_nm,
                    tmg.group_nm,
                    tmj.uuid as job_id,
                    tmj.job_no,
                    tmj.job_nm,
                    tmjt.job_type_nm,
                    tmjt.colors as job_type_color,
                    member_nm,
                    tro.plan_check_dt,
                    tro.actual_check_dt,
                    EXTRACT('day' from  tro.plan_check_dt) as idxDate
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
                JOIN ${table.tb_m_lines} tml
                    ON tml.line_id = tmm.line_id
                WHERE 
                    ${'tro.' + condDataNotDeleted}
                    ${whereCond}
            `)
            let mapObs = observations.rows.map(async obser => {
                let obserId = await uuidToId(table.tb_r_observations, 'observation_id', obser.observation_id)
                let checkersData = await queryGET(table.tb_r_obs_checker, `WHERE observation_id = ${obserId}`, ['uuid as obs_checker_id', 'checker_nm'])
                obser.checkers = await checkersData.map(mp => {
                    return mp.checker_nm
                })

                return obser
            })
            let waitDataObs = await Promise.all(mapObs)
            let containerGroup = []
            for (let i = 0; i < waitDataObs.length; i++) {
                const item = waitDataObs[i];
                let posAvail = containerGroup.find(child => child.pos_id === item.pos_id)

                if (!posAvail) {
                    item.children = []
                    item.children.push(JSON.parse(JSON.stringify(item)))
                    containerGroup.push(item)
                    continue;
                }
                posAvail.children.push(item)
            }
            let resAwait = await Promise.all(containerGroup)
            console.log(resAwait);
            response.success(res, 'Success to get schedule observation', resAwait)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get schedule observation')
        }
    },
    getDetailObservation: async(req, res) => {
        try {
            const obser = await queryCustom(`
                SELECT 
                    tro.uuid as observation_id,
                    tmp.uuid as pos_id,
                    tml.line_nm,
                    tml.line_snm,
                    tmp.pos_nm,
                    tmm.machine_nm,
                    tmg.group_nm,
                    tmj.uuid as job_id,
                    tmj.job_no,
                    tmj.job_nm,
                    tmjt.job_type_nm,
                    tmjt.colors as job_type_color,
                    member_nm,
                    tro.plan_check_dt,
                    tro.actual_check_dt,
                    EXTRACT('day' from  tro.plan_check_dt) as idxDate
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
                JOIN ${table.tb_m_lines} tml
                    ON tml.line_id = tmm.line_id
                WHERE 
                    ${'tro.' + condDataNotDeleted}
                    AND tro.uuid = '${req.params.id}'`)
            response.success(res, 'Success to get schedule observation', obser.rows)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get schedule observation')
        }
    },
    getSummaryObservations: async(req, res) => {
        try {
            const delay = await queryCustom(`
            SELECT 
                COUNT(observation_id) as delay_count
            FROM tb_r_observations
            WHERE
                deleted_dt IS NULL
                AND (EXTRACT(month from  plan_check_dt), EXTRACT('year' from plan_check_dt))=(6,2023)
                AND plan_check_dt < '2023-06-11'
                AND actual_check_dt IS NULL
            `)
            const done = await queryCustom(`
            SELECT 
                COUNT(observation_id) as done_count
            FROM tb_r_observations
            WHERE
                deleted_dt IS NULL
                AND (EXTRACT(month from  plan_check_dt), EXTRACT('year' from plan_check_dt))=(6,2023)
                AND actual_check_dt IS NOT NULL
            `)
            const total = await queryCustom(`
            SELECT 
                COUNT(observation_id) as total_count
            FROM tb_r_observations
            WHERE
                deleted_dt IS NULL
                AND (EXTRACT(month from  plan_check_dt), EXTRACT('year' from plan_check_dt))=(6,2023)
                AND actual_check_dt IS NOT NULL
            `)
            const objRes = {
                delay: +delay.rows[0].delay_count,
                done: +done.rows[0].done_count,
                total: +total.rows[0].total_count
            }
            response.success(res, 'Success to add schedule observation', objRes)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to add schedule observation')
        }
    }
}