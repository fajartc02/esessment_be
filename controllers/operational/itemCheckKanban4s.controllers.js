const table = require("../../config/table")
const {
    queryPOST,
    queryBulkPOST,
    queryCustom,
    queryGET,
    queryPUT,
    queryTransaction,
    queryPutTransaction,
    queryPostTransaction
} = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const {uuid} = require("uuidv4")

module.exports = {
    getItemCheckKanban4s: async (req, res) => {
        try {
            const {main_schedule_id, kanban_id} = req.query

            let scheduleItemCheckKanbanSql =
                `
                    select
                        tml.uuid as line_id,
                        tmg.uuid as group_id,
                        tmf.uuid as freq_id,
                        trmsc.uuid as main_schedule_id,
                        tmk.uuid as kanban_id,
                        tmick.uuid as item_check_kanban_id,
                        trsic.uuid as schedule_item_check_kanban_id,
                        tmju.uuid as judgment_id,
                        tml.line_nm,
                        tmg.group_nm,
                        tmk.kanban_no,
                        tmf.freq_nm,
                        tmick.item_check_nm,
                        trsic.actual_time,
                        tmju.judgment_nm,
                        trsic.checked_date,
                        date_part('week', trsic.changed_dt) as checked_week,
                        date_part('month', trsic.changed_dt) as checked_month
                    from
                        ${table.tb_r_4s_schedule_item_check_kanbans} trsic
                        left join ${table.tb_r_4s_main_schedules} trmsc on trsic.main_schedule_id = trmsc.main_schedule_id
                        left join ${table.tb_m_lines} tml on trmsc.line_id = tml.line_id
                        left join ${table.tb_m_groups} tmg on trmsc.group_id = tmg.group_id
                        left join ${table.tb_m_4s_item_check_kanbans} tmick on trsic.item_check_kanban_id = tmick.item_check_kanban_id
                        left join ${table.tb_m_kanbans} tmk on tmick.kanban_id = tmk.kanban_id
                        left join ${table.tb_m_freqs} tmf on tmk.freq_id = tmf.freq_id
                        left join ${table.tb_m_judgments} tmju on trsic.judgment_id = tmju.judgment_id
                    where
                        1 = 1
                `

            let filterCondition = []
            if (main_schedule_id) {
                filterCondition.push(` trmsc.uuid = '${main_schedule_id}' `)
            }

            if (kanban_id) {
                filterCondition.push(` tmk.uuid = '${kanban_id}' `)
            }

            if (filterCondition.length > 0) {
                filterCondition = filterCondition.join(' and ')
                scheduleItemCheckKanbanSql = scheduleItemCheckKanbanSql.concat(` and ${filterCondition} `)
            }


            const scheduleItemCheckKanbanQuery = await queryCustom(scheduleItemCheckKanbanSql)
            const result = scheduleItemCheckKanbanQuery.rows

            response.success(res, "Success to get 4s schedule item check kanban", result)
        } catch (e) {
            console.log(e)
            response.failed(res, "Error to get 4s schedule item check kanban")
        }
    },
    getAllItemCheckKanban4s: async (req, res) => {
        try {
            const {main_schedule_id, kanban_id} = req.query

            const itemCheckSql =
                `
                select distinct
                    on (
                        tbrcs.freq_id,
                        tbrcs.zone_id,
                        tbrcs.kanban_id,
                        tmic.item_check_kanban_id
                    )
                    tmk.uuid as kanban_uuid,
                    tmic.uuid as item_check_kanban_uuid,
                    tmf.uuid as freq_uuid,
                    tbrcs.main_schedule_id,
                    tmic.item_check_kanban_id,
                    tmk.kanban_id,
                    tbrcs.freq_id,
                    tbrcs.zone_id,
                    tmic.item_check_nm,
                    tmk.kanban_no,
                    tmic.standart_time,
                    tmf.freq_nm
                from
                    ${table.tb_r_4s_sub_schedules} tbrcs
                    join ${table.tb_m_4s_item_check_kanbans} tmic on tbrcs.kanban_id = tmic.kanban_id
                    join ${table.tb_m_kanbans} tmk on tmic.kanban_id = tmk.kanban_id
                    join ${table.tb_m_freqs} tmf on tbrcs.freq_id = tmf.freq_id
                where
                    1 = 1
                    tbrcs.main_schedule_id = (select main_schedule_id from ${table.tb_r_4s_main_schedules} where uuid = '${main_schedule_id}')
            `

            const itemCheckQuery = await queryCustom(itemCheckSql)
            let result = []

            if (itemCheckQuery && itemCheckQuery.rows.length > 0) {
                const childrenSql = (
                    freq = '',
                    mainScheduleRealId = 0,
                    freqRealId = 0,
                    kanbanRealId = 0,
                    zoneRealId = 0,
                    mstItemCheckKanbanRealId = 0
                ) => {
                    const joinWeekly = `
                            join (select date_part('week', "date"::date) week from tb_m_schedules group by week) tmsw
                                on date_part('week', tmsc."date"::date) = tmsw.week
                        `
                    const joinMonthly = `
                            join (select date_part('month', "date") as month from tb_m_schedules group by month) tmsw
                                on date_part('month', tmsc."date"::date) = tmsw.month
                        `
                    const sql = (distinct = '') => {
                        return `
                            select
                                    ${distinct}
                                    EXTRACT('Day' FROM tmsc.date)::INTEGER as offset,
                                    tmic.item_check_nm,
                                    tr4ssick.actual_time
                            from ${table.tb_r_4s_sub_schedules} tbrcs
                                    join ${table.tb_m_schedules} tmsc on tbrcs.schedule_id = tmsc.schedule_id
                                    join ${table.tb_m_4s_item_check_kanbans} tmic on tbrcs.kanban_id = tmic.kanban_id
                                    left join ${table.tb_r_4s_schedule_item_check_kanbans} tr4ssick
                                                on tmic.item_check_kanban_id = tr4ssick.item_check_kanban_id and
                                                    tr4ssick.sub_schedule_id = tbrcs.sub_schedule_id
                        `
                    }

                    const whereDistinct = `
                            where tbrcs.main_schedule_id = '${mainScheduleRealId}'
                            and tbrcs.freq_id = '${freqRealId}'
                            and tbrcs.kanban_id = '${kanbanRealId}'
                            and tbrcs.zone_id = '${zoneRealId}'
                            and tmic.item_check_kanban_id = '${mstItemCheckKanbanRealId}'
                        `

                    let result = ''
                    switch (freq.toLowerCase()) {
                        case 'day':
                            result = sql()
                            break;
                        case 'week':
                            result = sql('distinct on (tmsw.week) tmsw.week, ').concat(` ${joinWeekly} `)
                            break;
                        case 'month':
                            result = sql('distinct on (tmsw.month) tmsw.month, ').concat(` ${joinMonthly} `)
                            break;
                        default:
                            result = sql()
                            break;
                    }

                    result = result.concat(` ${whereDistinct} `)
                    return result
                }

                const itemCheckRows = itemCheckQuery.rows.map(async (item) => {
                    const cSql = childrenSql(
                        item.freq_nm,
                        item.main_schedule_id,
                        item.freq_id,
                        item.kanban_id,
                        item.zone_id,
                        item.item_check_kanban_id
                    )
                    //console.log(`cSql ${item.freq_nm}`, cSql)
                    const children = await queryCustom(cSql, false)
                    children.rows = children.rows.map((child) => {
                        if (child.week) {
                            child.offset = child.week
                            delete child.week
                        } else if (child.month) {
                            child.offset = child.month
                            delete child.month
                        }

                        return child
                    })


                    item.kanban_id = item.kanban_uuid
                    item.item_check_kanban_id = item.item_check_kanban_uuid
                    item.freq_id = item.freq_uuid
                    item.children = children.rows

                    delete item.freq_uuid
                    delete item.zone_id
                    delete item.kanban_uuid
                    delete item.item_check_kanban_uuid
                    delete item.main_schedule_id

                    return item
                })

                result = await Promise.all(itemCheckRows)
            }

            response.success(res, "Success to get 4s item check kanban", result)
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to get 4s item check kanban")
        }
    },
    postItemCheckKanban4s: async (req, res) => {
        try {
            const sqlFindMasterItemCheck = `select * from ${table.tb_m_4s_item_check_kanbans} where uuid = '${req.body.item_check_kanban_id}'`;
            let queryFindMasterItemCheck = (await queryCustom(sqlFindMasterItemCheck)).rows;
            if (!queryFindMasterItemCheck.length) {
                response.failed(res, "Error to add 4s schedule item check kanban, can't find item check");
                return;
            }

            queryFindMasterItemCheck = queryFindMasterItemCheck[0];

            const transaction = await queryTransaction(async (db) => {
                const body = {
                    ...req.body,
                    uuid: uuid(),
                    judgment_id: req.body.judgment_id ? ` (select judgment_id from ${table.tb_m_judgments} where uuid = '${req.body.judgment_id}') ` : '1',
                    main_schedule_id: ` (select main_schedule_id from ${table.tb_r_4s_main_schedules} where uuid = '${req.body.main_schedule_id}') `,
                    item_check_kanban_id: ` (select item_check_kanban_id from ${table.tb_m_4s_item_check_kanbans} where uuid = '${req.body.item_check_kanban_id}') `,
                }

                if (req.body.sub_schedule_id) {
                    body.sub_schedule_id = ` (select sub_schedule_id from ${table.tb_r_4s_sub_schedules} where uuid = '${req.body.sub_schedule_id}') `;
                }

                let checkExists = await db.query(
                    `
                        select 
                            * 
                        from 
                            ${table.tb_r_4s_schedule_item_check_kanbans} 
                        where
                            item_check_kanban_id = (select item_check_kanban_id from ${table.tb_m_4s_item_check_kanbans} where uuid = '${req.body.item_check_kanban_id}')
                            and sub_schedule_id = (select sub_schedule_id from ${table.tb_r_4s_sub_schedules} where uuid = '${req.body.sub_schedule_id}')
                            /* and main_schedule_id = (select main_schedule_id from ${table.tb_r_4s_main_schedules} where uuid = '${req.body.main_schedule_id}') */
                    `
                );

                let result;
                if (checkExists.rowCount > 0) {
                    const attr = attrsUserUpdateData(req, body);
                    result = await queryPutTransaction(
                        db,
                        table.tb_r_4s_schedule_item_check_kanbans,
                        attr,
                        `where schedule_item_check_kanban_id = '${checkExists.rows[0].schedule_item_check_kanban_id}'`
                    );
                } else {
                    const attrInsert = attrsUserInsertData(req, body);
                    result = await queryPostTransaction(db, table.tb_r_4s_schedule_item_check_kanbans, attrInsert);
                }

                if (result.rowCount) {
                    result = result.rows[0];
                }

                if (req.body.standart_time) {
                    const attrInsertHistory = attrsUserInsertData(req, [{
                        item_check_kanban_id: queryFindMasterItemCheck.item_check_kanban_id,
                        item_check_nm: queryFindMasterItemCheck.item_check_nm,
                        method: queryFindMasterItemCheck.method,
                        control_point: queryFindMasterItemCheck.control_point,
                        ilustration_imgs: queryFindMasterItemCheck.ilustration_imgs,
                        standart_time: req.body.standart_time,
                    }]);

                    await queryPostTransaction(db, table.tb_r_history_4s_item_check_kanbans, attrInsertHistory);
                }

                return result;
            });

            const result = {
                schedule_item_check_kanban_id: transaction.uuid
            }

            response.success(res, "Success to add 4s schedule item check kanban", result);
        } catch (e) {
            console.log(e)
            response.failed(res, "Error to add 4s schedule item check kanban");
        }
    },
    editItemCheckKanban4s: async (req, res) => {
        try {
            const sqlFindMasterItemCheck = `select * from ${table.tb_m_4s_item_check_kanbans} where uuid = '${req.body.item_check_kanban_id}'`;
            let queryFindMasterItemCheck = (await queryCustom(sqlFindMasterItemCheck)).rows;
            if (!queryFindMasterItemCheck.length) {
                response.failed(res, "Error to add 4s schedule item check kanban, can't find item check");
                return;
            }

            queryFindMasterItemCheck = queryFindMasterItemCheck[0];

            const scheduleItemCheckKanbanUuid = req.params.id
            //const { actual_time, judgement } = req.body

            const transaction = await queryTransaction(async (db) => {
                const updateBody = {
                    ...req.body,
                    judgment_id: ` (select judgment_id from ${table.tb_m_judgments} where uuid = '${req.body.judgment_id}') `,
                }

                const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
                let result = await queryPutTransaction(
                    db,
                    table.tb_r_4s_schedule_item_check_kanbans,
                    attrsUserUpdate,
                    `WHERE uuid = '${scheduleItemCheckKanbanUuid}'`
                );

                if (result.rowCount) {
                    result = result.rows[0];
                }

                if (req.body.standart_time) {
                    const attrInsertHistory = attrsUserInsertData(req, [{
                        item_check_kanban_id: queryFindMasterItemCheck.item_check_kanban_id,
                        item_check_nm: queryFindMasterItemCheck.item_check_nm,
                        method: queryFindMasterItemCheck.method,
                        control_point: queryFindMasterItemCheck.control_point,
                        ilustration_imgs: queryFindMasterItemCheck.ilustration_imgs,
                        standart_time: req.body.standart_time,
                    }]);

                    await queryPostTransaction(db, table.tb_r_history_4s_item_check_kanbans, attrInsertHistory);
                }

                return result;
            });

            const result = {
                schedule_item_check_kanban_id: transaction.rows[0].uuid
            }

            response.success(res, "Success to edit 4s schedule item check kanban", result)
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to edit 4s schedule item check kanban")
        }
    },
    deleteItemCheckKanban4s: async (req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split("+")[0].split("T").join(" "),
                deleted_by: req.user.fullname,
            }

            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(
                table.tb_r_4s_schedule_item_check_kanbans,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )
            response.success(res, "Success to soft delete 4s schedule item check kanban", result)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
}