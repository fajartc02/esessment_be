const table = require('../../config/table')
const { queryPOST, queryBulkPOST, queryCustom, queryGET, queryPUT } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const idToUuid = require('../../helpers/idToUuid')

const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const addAttrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const condDataNotDeleted = `deleted_dt IS NULL`

const moment = require('moment')

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
                // INSERT TO tb_r_observation
            delete req.body.checkers
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
    getObservationScheduleList: async(req, res) => {
        try {
            console.log('MASUUUUK');
            let { id, line, month, year } = req.query
            let containerQuery = ''
            if (id) containerQuery += ` AND tro.uuid = '${id}'`
            if (month && year) containerQuery = `AND (EXTRACT(month from  tro.plan_check_dt), EXTRACT('year' from tro.plan_check_dt))=(${+month},${+year})`
            if (line != "0" && line && line != -1) containerQuery += ` AND tml.line_id = ${await uuidToId(table.tb_m_lines, 'line_id', line)}`
            let observationList = await queryCustom(`
                SELECT 
                    tro.uuid as id,
                    tro.member_nm,
                    tro.plan_check_dt,
                    tro.actual_check_dt,
                    tro.created_dt,
                    tro.created_by,
                    tmp.uuid as pos_id,
                    tmp.pos_nm,
                    tml.uuid as line_id,
                    tml.line_nm,
                    tmj.uuid as job_id,
                    tmj.job_nm,
                    tmjt.job_type_nm,
                    tmj.attachment as sop,
                    tmg.uuid as group_id,
                    tmg.group_nm
                FROM ${table.tb_r_observations} tro
                JOIN ${table.tb_m_pos} tmp ON tmp.pos_id = tro.pos_id
                JOIN ${table.tb_m_lines} tml ON tml.line_id = tmp.line_id
                JOIN ${table.tb_m_jobs} tmj ON tmj.job_id = tro.job_id
                JOIN ${table.tb_m_job_types} tmjt ON tmjt.job_type_id = tmj.job_type_id
                JOIN ${table.tb_m_groups} tmg ON tmg.group_id = tro.group_id
                WHERE tro.${condDataNotDeleted}
                ${containerQuery}
            `)
            console.log(containerQuery);
            let mapObsCheckers = await observationList.rows.map(async obs => {
                let obsUuidtoId = await uuidToId(table.tb_r_observations, 'observation_id', obs.id)
                let checkers = await queryGET(table.tb_r_obs_checker, `WHERE observation_id = '${obsUuidtoId}'`, ['uuid as id', 'checker_nm'])
                obs.checkers = checkers
                    // console.log();
                console.log(obs);
                obs.plan_check_dt = moment(obs.plan_check_dt).format('YYYY-MM-DD')
                obs.actual_check_dt = obs.actual_check_dt ? moment(obs.actual_check_dt).format('YYYY-MM-DD') : null
                return obs
            })
            const waitObser = await Promise.all(mapObsCheckers)
            console.log(waitObser);
            response.success(res, 'Success to get schedule observation list', waitObser)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get schedule observation list')
        }
    },
    getScheduleObservations: async(req, res) => {
        try {
            const { month, year, line } = req.query
            let whereCond = ``
            if (month && year) whereCond = `AND (EXTRACT(month from  tro.plan_check_dt), EXTRACT('year' from tro.plan_check_dt))=(${+month},${+year})`
            if (line != "0" && line && line != -1) whereCond += ` AND tmp.line_id = ${await uuidToId(table.tb_m_lines, 'line_id', line)}`
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
                    EXTRACT('day' from  tro.plan_check_dt) as idxDate,
                    tro.deleted_dt
                FROM ${table.tb_r_observations} tro
                LEFT JOIN ${table.tb_m_pos} tmp
                    ON tro.pos_id = tmp.pos_id
                LEFT JOIN ${table.tb_m_groups} tmg
                    ON tro.group_id = tmg.group_id
                LEFT JOIN ${table.tb_m_jobs} tmj
                    ON tro.job_id = tmj.job_id
                LEFT JOIN ${table.tb_m_machines} tmm
                    ON tmj.machine_id = tmm.machine_id
                LEFT JOIN ${table.tb_m_job_types} tmjt
                    ON tmj.job_type_id = tmjt.job_type_id
                LEFT JOIN ${table.tb_m_lines} tml
                    ON tml.line_id = tmp.line_id
                WHERE 
                    ${'tro.' + condDataNotDeleted}
                    ${whereCond}
                ORDER BY tml.line_nm,tmp.pos_nm ASC
            `)
            console.log(whereCond);
            console.log(`${'tro.' + condDataNotDeleted}`);
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
            let obser = await queryCustom(`
                SELECT 
                    tro.uuid as observation_id,
                    tmp.uuid as pos_id,
                    tml.line_nm,
                    tml.line_snm,
                    tmp.pos_nm,
                    tmm.machine_nm,
                    tmg.uuid as group_id,
                    tmg.group_nm,
                    tmj.uuid as job_id,
                    tmj.job_no,
                    tmj.job_nm,
                    tmj.attachment as sop,
                    tmp.tsk,
                    tmp.tskk,
                    tmjt.job_type_nm,
                    tmjt.colors as job_type_color,
                    member_nm,
                    tro.plan_check_dt,
                    tro.actual_check_dt,
                    EXTRACT('day' from  tro.plan_check_dt) as idxDate
                FROM ${table.tb_r_observations} tro
                LEFT JOIN ${table.tb_m_pos} tmp
                    ON tro.pos_id = tmp.pos_id  
                LEFT JOIN ${table.tb_m_groups} tmg
                    ON tro.group_id = tmg.group_id
                LEFT JOIN ${table.tb_m_jobs} tmj
                    ON tro.job_id = tmj.job_id
                LEFT JOIN ${table.tb_m_machines} tmm
                    ON tmj.machine_id = tmm.machine_id
                LEFT JOIN ${table.tb_m_job_types} tmjt
                    ON tmj.job_type_id = tmjt.job_type_id
                LEFT JOIN ${table.tb_m_lines} tml
                    ON tml.line_id = tmp.line_id
                WHERE 
                    ${'tro.' + condDataNotDeleted}
                    AND tro.uuid = '${req.params.id}'`)
            await obser.rows.map(itm => {
                itm.plan_check_dt = moment(itm.plan_check_dt).format('YYYY-MM-DD')
                itm.actual_check_dt = moment(itm.actual_check_dt).format('YYYY-MM-DD')
                return itm
            })
            const obsId = await uuidToId(table.tb_r_observations, 'observation_id', req.params.id)
            let resChecks = await queryGET(table.tb_r_obs_results, `WHERE observation_id = ${obsId}`, ['category_id', 'judgment_id', 'factor_id', 'findings'])
            let mapChecks = await resChecks.map(async check => {
                check.category_id = await idToUuid(table.tb_m_categories, 'category_id', check.category_id)
                if (check.factor_id) check.factor_id = await idToUuid(table.tb_m_factors, 'factor_id', check.factor_id)
                check.judgment_id = await idToUuid(table.tb_m_judgments, 'judgment_id', check.judgment_id)
                console.log(check);
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
            let { month, year, currentDate, line_id } = req.query

            var whereLineId = ``
            console.log(req.query);
            if (line_id) {
                whereLineId = `AND tmp.line_id = ${await uuidToId(table.tb_m_lines, 'line_id', line_id)}`
            }

            const delay = await queryCustom(`
            SELECT 
                COUNT(observation_id) as delay_count
            FROM tb_r_observations tro
            JOIN tb_m_pos tmp
                ON tro.pos_id = tmp.pos_id
            WHERE
                ${'tro.' + condDataNotDeleted}
                AND (EXTRACT(month from  plan_check_dt), EXTRACT('year' from plan_check_dt))=(${month},${year})
                AND plan_check_dt < '${currentDate}'
                AND actual_check_dt IS NULL
                ${whereLineId}
            `)
            const done = await queryCustom(`
            SELECT 
                COUNT(observation_id) as done_count
            FROM tb_r_observations tro
            JOIN tb_m_pos tmp
                ON tro.pos_id = tmp.pos_id
            WHERE
                ${'tro.' + condDataNotDeleted}
                AND (EXTRACT(month from  plan_check_dt), EXTRACT('year' from plan_check_dt))=(${month},${year})
                AND actual_check_dt IS NOT NULL
                ${whereLineId}
            `)
            const total = await queryCustom(`
            SELECT 
                COUNT(observation_id) as total_count
            FROM tb_r_observations tro
            JOIN tb_m_pos tmp
                ON tro.pos_id = tmp.pos_id
            WHERE
                ${'tro.' + condDataNotDeleted}
                AND (EXTRACT(month from  plan_check_dt), EXTRACT('year' from plan_check_dt))=(${month},${year})
                ${whereLineId}
            `)
            const objRes = {
                delay: +delay.rows[0].delay_count,
                done: +done.rows[0].done_count,
                total: +total.rows[0].total_count
            }
            response.success(res, 'Success to get summary observation', objRes)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get summary observation')
        }
    },
    addCheckObservation: async(req, res) => {
        // observation_id
        // category_id,judgement_id, factor_id(opt), findings ARRAY
        try {
            console.log(req.body);
            // UPDATE tb_r_observations ALREADY CHECK
            const obsId = await uuidToId(table.tb_r_observations, 'observation_id', req.body.observation_id)
            const groupId = await uuidToId(table.tb_m_groups, 'group_id', req.body.group_id)
            let updateActual = { actual_check_dt: req.body.actual_check_dt, group_id: groupId }
            let attrsUserUpd = await addAttrsUserUpdateData(req, updateActual)
            await queryPUT(table.tb_r_observations, attrsUserUpd, `WHERE observation_id = '${obsId}'`)

            // INSERT tb_r_obs_results FROM req.body.results_check
            let resultCheckData = req.body.results_check
            const lastIdResCheck = await getLastIdData(table.tb_r_obs_results, 'obs_result_id') + 1
            let mapResultChecks = await resultCheckData.map(async(item, i) => {
                item.observation_id = obsId
                item.obs_result_id = lastIdResCheck + i
                item.uuid = req.uuid()
                item.category_id = await uuidToId(table.tb_m_categories, 'category_id', item.category_id)
                item.judgment_id = await uuidToId(table.tb_m_judgments, 'judgment_id', item.judgment_id)
                return item
            })
            let waitMapResCheck = await Promise.all(mapResultChecks)
            const addAttrsUserInst = await attrsUserInsertData(req, waitMapResCheck)
            req.body.group_id = await uuidToId(table.tb_m_groups, 'group_id', req.body.group_id)
            let resInstCheck = await queryBulkPOST(table.tb_r_obs_results, addAttrsUserInst)
                // console.log(resInstCheck.rows);
                // {
                //     obs_result_id: 531,
                //     observation_id: 234,
                //     uuid: '7c83798b-fd73-4487-a339-287608ad7142',
                //     category_id: 1,
                //     judgment_id: 1,
                //     created_by: 'Fajar Tri Cahyono',
                //     created_dt: 2024-02-02T18:17:27.000Z,
                //     changed_by: 'Fajar Tri Cahyono',
                //     changed_dt: 2024-02-02T18:17:27.000Z,
                //     deleted_by: null,
                //     deleted_dt: null
                //   },

            // INSERT tb_r_result_findings, GET obs_result_id AFTER INSERT tb_r_obs_results
            let findingsMapInstData = await resInstCheck.rows.map(async resCheckData => {
                // CHECK ANY JUDG ABNORMAL
                let judgData = await queryGET(table.tb_m_judgments, `WHERE judgment_id = ${resCheckData.judgment_id}`, ['is_abnormal'])
                let isJudgAbnor = judgData[0].is_abnormal
                    // console.log(isJudgAbnor);
                if (isJudgAbnor) {
                    // console.log(req.body.findings);
                    // console.log(resCheckData.category_id);
                    let selectFindingData = await req.body.findings.find(async(finding) => await uuidToId(table.tb_m_categories, 'category_id', finding.category_id) == resCheckData.category_id)
                    let obs_result_id = resCheckData.obs_result_id
                    selectFindingData.category_id = await uuidToId(table.tb_m_categories, 'category_id', selectFindingData.category_id) ?? null
                    selectFindingData.cm_pic_id = await uuidToId(table.tb_m_users, 'user_id', selectFindingData.cm_pic_id) ?? null
                    selectFindingData.factor_id = await uuidToId(table.tb_m_factors, 'factor_id', selectFindingData.factor_id) ?? null
                    selectFindingData.cm_result_factor_id = await uuidToId(table.tb_m_factors, 'factor_id', selectFindingData.cm_result_factor_id) ?? null
                    selectFindingData.uuid = req.uuid()
                    let findingObj = {
                        ...selectFindingData,
                        obs_result_id,
                    }
                    let attrsUserFindingData = await attrsUserInsertData(req, findingObj)
                    return {
                        ...attrsUserFindingData
                    }
                }
                return null
            })

            let waitFindingsMap = await Promise.all(findingsMapInstData);
            console.log(waitFindingsMap);
            for (let i = 0; i < waitFindingsMap.length; i++) {
                const findingData = waitFindingsMap[i];
                if (findingData) {
                    await queryPOST(table.tb_r_result_findings, findingData);
                }
            }
            // console.log(findingsData);
            /* 
                * update tb_r_observations already check
                * insert tb_r_obs_results
                * fetch id after insert tb_r_obs_results to set at obs_result_id
                * insert tb_r_result_findings
                    "obs_result_id" int4 NOT NULL,
                    "uuid" varchar(40) NOT NULL,
                    "finding_desc" text NOT NULL,
                    "ft_id" int4,
                    "henkaten_id" int4,
                    "mv_id" int4,
                    "cm_desc" text,
                    "cm_priority" text,
                    "factor_id" int4 NOT NULL,
                    "category_id" int4 NOT NULL,
                    "cm_pic_id" int,
                    "cm_str_plan_date" date,
                    "cm_end_plan_date" date,
                    "cm_start_act_date" date,
                    "cm_end_act_date" date,
                    "cm_result_factor_id" int4,
                    "cm_training_date" date,
                    "cm_judg" bool,
                    "cm_sign_lh_red" text,
                    "cm_sign_lh_white" text,
                    "cm_sign_sh" text,
                    "cm_comments" text,
            */

            response.success(res, 'Success to add CHECK observation')
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to add CHECK observation')
        }
    },
    deleteScheduleObservation: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await addAttrsUserUpdateData(req, obj)
            console.log(attrsUserUpdate);
            const result = await queryPUT(table.tb_r_observations, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete obser', result)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to delete schedule observation list')
        }
    },
}