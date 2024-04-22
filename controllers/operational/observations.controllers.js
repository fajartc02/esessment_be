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
            let { id, line, month, year, limit, current_page } = req.query
            let containerQuery = ''
            let qLimit = ``
            let qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            if (limit != -1 && limit) qLimit = `LIMIT ${limit}`
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
                ${containerQuery} ${qLimit} ${qOffset}
            `)
            let countTotal = await queryCustom(`SELECT 
            count(tro.observation_id) as total
        FROM ${table.tb_r_observations} tro
        JOIN ${table.tb_m_pos} tmp ON tmp.pos_id = tro.pos_id
        JOIN ${table.tb_m_lines} tml ON tml.line_id = tmp.line_id
        JOIN ${table.tb_m_jobs} tmj ON tmj.job_id = tro.job_id
        JOIN ${table.tb_m_job_types} tmjt ON tmjt.job_type_id = tmj.job_type_id
        JOIN ${table.tb_m_groups} tmg ON tmg.group_id = tro.group_id
        WHERE tro.${condDataNotDeleted}
        ${containerQuery}`)
            const totalRowTable = await countTotal.rows[0].total
            let mapObsCheckers = await observationList.rows.map(async obs => {
                let obsUuidtoId = await uuidToId(table.tb_r_observations, 'observation_id', obs.id)
                let checkers = await queryGET(table.tb_r_obs_checker, `WHERE observation_id = '${obsUuidtoId}'`, ['uuid as id', 'checker_nm'])
                obs.checkers = checkers
                obs.total_page = +totalRowTable > 0 ? Math.ceil(totalRowTable / +limit) : 0
                obs.limit = +limit
                obs.current_page = +current_page
                obs.total_data = +totalRowTable;
                obs.plan_check_dt = moment(obs.plan_check_dt).format('YYYY-MM-DD')
                obs.actual_check_dt = obs.actual_check_dt ? moment(obs.actual_check_dt).format('YYYY-MM-DD') : null
                return obs
            })
            const waitObser = await Promise.all(mapObsCheckers)
            // console.log(waitObser);
            response.success(res, 'Success to get schedule observation list', waitObser)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get schedule observation list')
        }
    },
    getScheduleObservations: async(req, res) => {
        try { 
            const { month, year, line, group_id } = req.query
            let whereCond = ``
            console.log(req.query);
            if (month && year) whereCond = `AND (EXTRACT(month from  tro.plan_check_dt), EXTRACT('year' from tro.plan_check_dt))=(${+month},${+year})`
            if (line != "0" && line && line != -1 && line != null) whereCond += ` AND tmp.line_id = ${await uuidToId(table.tb_m_lines, 'line_id', line)}`
            if (group_id && group_id != null) whereCond += ` AND tmg.uuid = '${group_id}'`
            let observations = await queryCustom(`
                SELECT 
                    tro.uuid as observation_id,
                    tmp.uuid as pos_id,
                    tml.uuid as line_id,
                    tml.line_snm,
                    tmp.pos_nm,
                    tmm.machine_nm,
                    tmg.uuid AS group_id,
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
                    tro.comment_sh,
                    tro.comment_ammgr,
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
            let mapObs = observations.rows.map(async obser => {
                let obserId = await uuidToId(table.tb_r_observations, 'observation_id', obser.observation_id)
                let checkersData = await queryGET(table.tb_r_obs_checker, `WHERE observation_id = ${obserId}`, ['uuid as obs_checker_id', 'checker_nm'])
                let qCheckFinding = `
                    SELECT * FROM ${table.v_finding_list} WHERE observation_id = '${obserId}'
                `
                let findingData = await queryCustom(qCheckFinding);
                let is_finding = findingData.rows.length > 0
                obser.is_finding = is_finding
                obser.checkers = await checkersData.map(mp => {
                    return mp.checker_nm
                })
                obser.checkers.length > 1 ? obser.is_wajik = true : obser.is_wajik = false
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
            // console.log(resAwait);
            response.success(res, 'Success to get schedule observation', resAwait)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get schedule observation')
        }
    },
    getTodaySchedule: async(req, res) => {
        try {
            const { date, line_id, group_id } = req.query
            let whereCond = ``
            console.log(req.query);
            whereCond = `AND tro.plan_check_dt = '${date}'`
            if (line_id != "0" && line_id && line_id != -1 && line_id != null) whereCond += ` AND tmp.line_id = '${await uuidToId(table.tb_m_lines, 'line_id', line_id)}'`
            if (group_id && group_id != null) whereCond += ` AND tmg.uuid = '${group_id}'`
            let observations = await queryCustom(`
                SELECT 
                    tro.uuid as observation_id,
                    tmp.uuid as pos_id,
                    tml.uuid as line_id,
                    tml.line_snm,
                    tmp.pos_nm,
                    tmm.machine_nm,
                    tmg.uuid AS group_id,
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
                    tro.comment_sh,
                    tro.comment_ammgr,
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
            response.success(res, 'Success to get today schedule observation', observations.rows)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get today schedule observation')
        }
    },
    getDetailObservation: async(req, res) => {
        try {
            let obser = await queryCustom(`
                SELECT 
                    tro.uuid as observation_id,
                    tmp.uuid as pos_id,
                    tml.uuid as line_id,
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
                    tro.comment_sh,
                    tro.comment_ammgr,
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
                // factor_id, findings isn't USED AGAIN BECAUSE ALREADY ENHANCEMENT
            let resChecks = await queryGET(table.tb_r_obs_results, `WHERE observation_id = ${obsId}`, ['obs_result_id', 'category_id', 'judgment_id', 'stw_ct1', 'stw_ct2', 'stw_ct3', 'stw_ct4', 'stw_ct5'])
            let mapChecks = await resChecks.map(async check => {
                check.category_id = await idToUuid(table.tb_m_categories, 'category_id', check.category_id)
                let categoryData = await queryGET(table.tb_m_categories, `WHERE uuid = '${check.category_id}'`, ['category_nm'])
                check.category_nm = categoryData[0].category_nm
                let resFindingIdData = await queryGET(table.tb_r_result_findings, `WHERE obs_result_id = ${check.obs_result_id}`, ['uuid'])
                let resFindingId = resFindingIdData[0]?.uuid ?? null
                check.findings = resFindingId ? await queryGET(table.v_finding_list, `WHERE finding_obs_id = '${resFindingId}'`) : []
                check.judgment_id = await idToUuid(table.tb_m_judgments, 'judgment_id', check.judgment_id) ?? null
                return check
            })

            const waitResChecks = await Promise.all(mapChecks)
            let isStw = true
            const mapResCheckAvg = await waitResChecks.map((item, i) => {
                let avg = null
                    // ((max (dari 5 input) - min (dari 5 input) / 2) / AVG) x 100%
                let perc = null
                if (isStw && item.stw_ct1) {
                    let containerCT = []
                    containerCT.push(+item.stw_ct1)
                    containerCT.push(+item.stw_ct2)
                    containerCT.push(+item.stw_ct3)
                    containerCT.push(+item.stw_ct4)
                    containerCT.push(+item.stw_ct5)
                    avg = item.stw_ct1 ? (item.stw_ct1 + item.stw_ct2 + item.stw_ct3 + item.stw_ct4 + item.stw_ct5) / 5 : null;
                    perc = +((((Math.max(...containerCT) - Math.min(...containerCT)) / 2) / avg) * 100).toFixed(2)
                    isStw = false
                }
                item.avg = avg ?? null
                item.perc = perc ?? null
                return item
            })
            obser.rows.push(mapResCheckAvg)
            response.success(res, 'Success to get detail schedule observation', obser.rows)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get detail schedule observation')
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
            req.body.results_check = JSON.parse(req.body.results_check)
            req.body.findings = JSON.parse(req.body.findings)
            
            // console.log(req.body);
            // 1. UPDATE tb_r_observations ALREADY CHECK
            const obsId = await uuidToId(table.tb_r_observations, 'observation_id', req.body.observation_id)
            const groupId = await uuidToId(table.tb_m_groups, 'group_id', req.body.group_id)
            let updateActual = {
                actual_check_dt: req.body.actual_check_dt,
                group_id: groupId,
                comment_sh: req.body.comment_sh,
                comment_ammgr: req.body.comment_ammgr
            }
            let attrsUserUpd = await addAttrsUserUpdateData(req, updateActual)
            await queryPUT(table.tb_r_observations, attrsUserUpd, `WHERE observation_id = '${obsId}'`)

            // 2. INSERT tb_r_obs_results FROM req.body.results_check
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

            // 3. INSERT tb_r_result_findings, GET obs_result_id AFTER INSERT tb_r_obs_results
            // REV: tb_r_result_findings (result_finding_id, uuid, obs_result_id)
            let findingsMapInstData = await resInstCheck.rows.map(async resCheckData => {
                let judgData = await queryGET(table.tb_m_judgments, `WHERE judgment_id = ${resCheckData.judgment_id}`, ['is_abnormal'])
                let isJudgAbnor = judgData[0].is_abnormal
                if (isJudgAbnor) {
                    let selectFindingData = await req.body.findings.find(async(finding) => await uuidToId(table.tb_m_categories, 'category_id', finding.category_id) == resCheckData.category_id)
                    let obs_result_id = resCheckData.obs_result_id
                    selectFindingData.category_id = await uuidToId(table.tb_m_categories, 'category_id', selectFindingData.category_id) ?? null
                    selectFindingData.line_id = await uuidToId(table.tb_m_lines, 'line_id', selectFindingData.line_id) ?? null
                    selectFindingData.cm_pic_id = await uuidToId(table.tb_m_users, 'user_id', selectFindingData.cm_pic_id.pic_id) ?? null
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
            // console.log(waitFindingsMap);

            for (let i = 0; i < waitFindingsMap.length; i++) {
                const findingData = waitFindingsMap[i];
                if (findingData) {
                    let objResultFinding = {
                        result_finding_id: await getLastIdData(table.tb_r_result_findings, 'result_finding_id') + 1,
                        uuid: req.uuid(),
                        obs_result_id: findingData.obs_result_id
                    }
                    let instDataObsFinding = await queryPOST(table.tb_r_result_findings, objResultFinding);
                    let obsFindingId = instDataObsFinding.rows[0].result_finding_id

                    delete findingData.obs_result_id;
                    // 4. INSERT to tb_r_findings
                    let lastFindingId = await getLastIdData(table.tb_r_findings, 'finding_id') + 1
                    let dataFinding = {
                        uuid: req.uuid(),
                        finding_id: lastFindingId,
                        finding_obs_id: obsFindingId,
                        cm_judg: waitFindingsMap.cm_judg,
                        ...findingData
                    }
                    await queryPOST(table.tb_r_findings, dataFinding)
                }
            }
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