const table = require('../../config/table')
const { queryPOST, queryBulkPOST, queryCustom, queryGET, queryPUT } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const idToUuid = require('../../helpers/idToUuid')

const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const addAttrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
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
                // let checkers = checker nanti dulu yapps

            const obsId = await uuidToId(table.tb_r_observations, 'observation_id', req.params.id)
            let resChecks = await queryGET(table.tb_r_obs_results, `WHERE observation_id = ${obsId}`, ['category_id', 'judgment_id', 'factor_id', 'findings'])
            let mapChecks = await resChecks.map(async check => {
                check.category_id = await idToUuid(table.tb_m_categories, 'category_id', check.category_id)
                if (check.factor_id) check.factor_id = await idToUuid(table.tb_m_factors, 'factor_id', check.factor_id)
                check.judgment_id = await idToUuid(table.tb_m_judgments, 'judgment_id', check.judgment_id)
                return check
            })
            const waitResChecks = await Promise.all(mapChecks)
            console.log(waitResChecks);
            obser.rows.push(waitResChecks)
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
    },
    addCheckObservation: async(req, res) => {
        // observation_id
        // category_id,judgement_id, factor_id(opt), findings ARRAY
        try {
            const obsId = await uuidToId(table.tb_r_observations, 'observation_id', req.body.observation_id)
            const lastIdResCheck = await getLastIdData(table.tb_r_obs_results, 'obs_result_id') + 1
            let mapResultChecks = await req.body.results_check.map(async(item, i) => {
                item.observation_id = obsId
                item.obs_result_id = lastIdResCheck + i
                item.uuid = req.uuid()
                console.log(item);
                item.category_id = await uuidToId(table.tb_m_categories, 'category_id', item.category_id)
                item.judgment_id = await uuidToId(table.tb_m_judgments, 'judgment_id', item.judgment_id)
                if (item.factor_id) item.factor_id = await uuidToId(table.tb_m_factors, 'factor_id', item.factor_id)
                return item
            })
            let waitMap = await Promise.all(mapResultChecks)
            const addAttrsUserInst = await attrsUserInsertData(req, waitMap)

            let resInstCheck = await queryBulkPOST(table.tb_r_obs_results, addAttrsUserInst)
            let updateActual = { actual_check_dt: req.body.actual_check_dt }
            let attrsUserUpd = await addAttrsUserUpdateData(req, updateActual)
            await queryPUT(table.tb_r_observations, attrsUserUpd, `WHERE observation_id = '${obsId}'`)
            console.log(resInstCheck);
            response.success(res, 'Success to add CHECK observation')
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to add CHECK observation')
        }
    }
}