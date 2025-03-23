const table = require("../../config/table")
const {
    queryPUT,
    queryGET,
    queryCustom,
    queryPOST,
    queryTransaction,
    queryPostTransaction,
    queryPutTransaction
} = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")

const moment = require("moment")
const { uuid } = require("uuidv4")

module.exports = {
    get4sFindingList: async (req, res) => {
        try
        {
            let { id, line_id, freq_id, group_id, zone_id, kanban_id, limit, current_page } = req.query
            const fromCondition = `  
                ${table.v_4s_finding_list} vfl 
            `

            current_page = parseInt(current_page ?? 1)
            limit = parseInt(limit ?? 10)

            let filterCondition = [
                'vfl.deleted_dt is null'
            ]

            let findingSql = `
                    select
                        row_number () over (
                            order by
                            vfl.plan_cm_date,
                            case 
                                when cm_judg = true then 1
                                else 2
                            end
                        )::integer as no,
                        *,
                        case when finding_img is not null then
                            finding_img
                        end as finding_img
                    from
                       ${fromCondition}
                    where
                        
                `
            //#region filter
            if (id)
            {
                filterCondition.push(` vfl.finding_id = '${id}' `)
            }
            if (line_id)
            {
                filterCondition.push(` vfl.line_id = '${line_id}' `)
            }
            if (zone_id)
            {
                filterCondition.push(` vfl.zone_id = '${zone_id}' `)
            }
            if (kanban_id)
            {
                filterCondition.push(` vfl.kanban_id = '${kanban_id}' `)
            }
            if (freq_id)
            {
                filterCondition.push(` vfl.freq_id = '${freq_id}' `)
            }
            if (group_id)
            {
                filterCondition.push(` vfl.group_id = '${group_id}' `)
            }
            if (req.query.start_date && req.query.end_date)
            {
                filterCondition.push(` vfl.finding_date between '${req.query.start_date}' and '${req.query.end_date}' `)
            }
            const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
            const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``


            filterCondition = filterCondition.join(' and ')
            findingSql = findingSql.concat(` ${filterCondition} `)
            findingSql = findingSql.concat(
                ` 
                    order by vfl.plan_cm_date,
                      case 
                          when cm_judg = true then 1
                          else 2
                      end ${qLimit} ${qOffset} 
                `
            )
            //#endregion

            let findingQuery = await queryCustom(findingSql)
            const nullId = id == null || id == -1 || id == ''
            let result = findingQuery.rows

            if (result.length > 0)
            {
                if (nullId)
                {
                    const count = await queryCustom(`select count(*)::integer as count from ${fromCondition} where ${filterCondition}`)
                    const countRows = count.rows[0]
                    result = {
                        current_page: current_page,
                        total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +limit) : 0,
                        total_data: countRows.count,
                        limit: limit,
                        list: findingQuery.rows.map((item) => {
                            item.kaizen_file = item.kaizen_file ? process.env.APP_HOST + "/file?path=" + item.kaizen_file : null;
                            return item;
                        }),
                    };
                } else
                {
                    result = result[0];
                    result.kaizen_file = result.kaizen_file ? process.env.APP_HOST + "/file?path=" + result.kaizen_file : null;
                }
            }

            response.success(res, 'Success to get 4s finding list', result)
        } catch (error)
        {
            console.log(error);
            response.failed(res, 'Error to get 4s finding list')
        }
    },
    post4sFinding: async (req, res) => {
        try
        {

            const rawSubScheduleId = ` (select sub_schedule_id from ${table.tb_r_4s_sub_schedules} where uuid = '${req.body.sub_schedule_id}') `;
            const rawScheduleItemCheckKanbanId = ` (select schedule_item_check_kanban_id from ${table.tb_r_4s_schedule_item_check_kanbans} where uuid = '${req.body.schedule_item_check_kanban_id}') `;
            const rawFindingPicId = ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.finding_pic_id}') `;

            const insertBody = {
                ...req.body,
                uuid: uuid(),
                sub_schedule_id: req.body.sub_schedule_id ? rawSubScheduleId : null,
                schedule_item_check_kanban_id: req.body.schedule_item_check_kanban_id ? rawScheduleItemCheckKanbanId : null,
                finding_pic_id: rawFindingPicId,
            };

            if (req.body.line_id)
            {
                insertBody.line_id = `(select line_id from ${table.tb_m_lines} where uuid = '${req.body.line_id}')`
            }

            if (req.body.group_id)
            {
                insertBody.group_id = `(select group_id from ${table.tb_m_groups} where uuid = '${req.body.group_id}')`
            }

            if (req.body.zone_id)
            {
                insertBody.zone_id = `(select zone_id from ${table.tb_m_zones} where uuid = '${req.body.zone_id}')`
            }

            if (req.body.freq_id)
            {
                insertBody.freq_id = `(select freq_id from ${table.tb_m_freqs} where uuid = '${req.body.freq_id}')`
            }

            if (req.body.kanban_id)
            {
                insertBody.kanban_id = `(select kanban_id from ${table.tb_m_kanbans} where uuid = '${req.body.kanban_id}')`
            }

            if (req.body.judgment_id)
            {
                insertBody.judgment_id = `(select judgment_id from ${table.tb_m_judgments} where uuid = '${req.body.judgment_id}')`
            }
            else 
            {
                insertBody.judgment_id = `(select judgment_id from ${table.tb_m_judgments} where lower(judgment_nm) = 'ng')`
            }

            if (insertBody.deleted_dt)
            {
                delete insertBody.deleted_dt
            }
            if (insertBody.deleted_by)
            {
                delete insertBody.deleted_by
            }

            if (req.body.actual_pic_id)
            {
                insertBody.actual_pic_id = ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.actual_pic_id}') `
            }

            const transaction = await queryTransaction(async (db) => {
                const insertion = async () => {
                    const attrsInsert = await attrsUserInsertData(req, insertBody)
                    return await queryPostTransaction(db, table.tb_r_4s_findings, attrsInsert)
                }

                if (req.body.is_input)
                {
                    return await insertion();
                }

                let exists = await queryCustom(`select *
                                                    from
                                                        ${table.tb_r_4s_findings}
                                                    where
                                                          sub_schedule_id = ${rawSubScheduleId}
                                                      and schedule_item_check_kanban_id = ${rawScheduleItemCheckKanbanId}
                                                      and deleted_dt is null`);
                if (exists.rowCount > 0)
                {
                    delete insertBody.uuid;
                    const attrsUserUpdate = await attrsUserUpdateData(req, insertBody);

                    return await queryPutTransaction(
                        db,
                        table.tb_r_4s_findings,
                        attrsUserUpdate,
                        `WHERE finding_id = ${exists.rows[0].finding_id}`
                    );
                } else
                {
                    return await insertion();
                }
            });

            response.success(res, "Success to add 4s finding", {
                finding_id: transaction.rows[0].uuid
            });
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
    edit4sFinding: async (req, res) => {
        try
        {
            if (!req.params.id || req.params.id == null || req.params.id == 'null')
            {
                throw "finding id not provided"
            }

            const exists = await queryCustom(`select * from ${table.tb_r_4s_findings} where uuid = '${req.params.id}'`)
            if (!exists)
            {
                throw "Can't find finding data by finding_id provide"
            }

            const updateBody = {
                ...req.body,
                sub_schedule_id: ` (select sub_schedule_id from ${table.tb_r_4s_sub_schedules} where uuid = '${req.body.sub_schedule_id}') `,
                schedule_item_check_kanban_id: ` (select schedule_item_check_kanban_id from ${table.tb_r_4s_schedule_item_check_kanbans} where uuid = '${req.body.schedule_item_check_kanban_id}') `,
                finding_pic_id: ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.finding_pic_id}') `,
            }

            if (req.body.actual_pic_id)
            {
                updateBody.actual_pic_id = ` (select user_id from ${table.tb_m_users} where uuid = '${req.body.actual_pic_id}') `
            }

            await queryTransaction(async (db) => {
                const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
                return await queryPutTransaction(
                    db,
                    table.tb_r_4s_findings,
                    attrsUserUpdate,
                    `WHERE uuid = '${req.params.id}'`
                )
            })

            response.success(res, "Success to edit 4s finding", {
                finding_id: req.params.id
            })
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
    upload4sImageFinding: async (req, res) => {
        try
        {
            const finding_img = `./${req.file.path}`
            const attrsUserUpdate = await attrsUserUpdateData(req, {
                finding_img: finding_img
            })

            await queryPUT(table.tb_r_4s_findings, attrsUserUpdate, `WHERE uuid = '${req.body.finding_id}'`);
            response.success(res, 'Success to upload 4s image finding', req.body.finding_img);
        } catch (error)
        {
            response.failed(res, 'Error to upload 4s image finding ' + error?.message ?? '')
        }
    },
    delete4sFinding: async (req, res) => {
        try
        {
            let obj = {
                deleted_dt: moment().format().split("+")[0].split("T").join(" "),
                deleted_by: req.user.fullname,
            }

            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(
                table.tb_r_4s_findings,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )
            response.success(res, "Success to soft delete freq", result)
        } catch (error)
        {
            console.log(error)
            response.failed(res, error)
        }
    },
    uploadKaizenFile: async (req, res) => {
        try
        {

            try
            {
                const kaizen_file = `./${req.file.path}`
                const attrsUserUpdate = await attrsUserUpdateData(req, {
                    kaizen_file: kaizen_file
                });

                const sqlFindFinding = `select
                                                    tr4sf.*,
                                                    tr4ssick.item_check_kanban_id,
                                                    tr4ssick.sub_schedule_id,
                                                    tm4sick.item_check_nm,
                                                    tm4sick.control_point,
                                                    tm4sick.method,
                                                    tm4sick.ilustration_imgs,
                                                    tm4sick.standart_time
                                                from
                                                    tb_r_4s_findings tr4sf
                                                        left join public.tb_r_4s_schedule_item_check_kanbans tr4ssick
                                                             on tr4sf.schedule_item_check_kanban_id = tr4ssick.schedule_item_check_kanban_id
                                                        left join tb_m_4s_item_check_kanbans tm4sick on tr4ssick.item_check_kanban_id = tm4sick.item_check_kanban_id
                                                where 
                                                    tr4sf.uuid = '${req.body.finding_id}'`;

                let queryFindFinding = (await queryCustom(sqlFindFinding)).rows;
                if (!queryFindFinding.length)
                {
                    response.failed(res, 'Error to upload 4s kaizen finding, finding not found');
                    return;
                }

                queryFindFinding = queryFindFinding[0];

                if (!queryFindFinding.item_check_kanban_id && req.body.item_check_kanban_id)
                {
                    queryFindFinding.item_check_kanban_id = `(select item_check_kanban_id from ${table.tb_m_4s_item_check_kanbans} where uuid = '${req.body.item_check_kanban_id}')`;
                }

                await queryTransaction(async (db) => {
                    await queryPutTransaction(
                        db,
                        table.tb_r_4s_findings,
                        attrsUserUpdate,
                        `WHERE uuid = '${req.body.finding_id}'`
                    );

                    if (queryFindFinding.item_check_kanban_id)
                    {
                        await queryPostTransaction(
                            db,
                            table.tb_r_history_4s_item_check_kanbans,
                            {
                                item_check_kanban_id: queryFindFinding.item_check_kanban_id,
                                sub_schedule_id: queryFindFinding.sub_schedule_id,
                                kaizen_file: queryFindFinding.kaizen_file,
                                created_by: req.user.noreg,
                                created_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
                            }
                        );
                    }

                    if (queryFindFinding.kaizen_file)
                    {
                        /*const sqlFindAvailHistory = `select
                                                                * 
                                                            from 
                                                                ${table.tb_r_history_4s_item_check_kanbans} 
                                                            where 
                                                                item_check_kanban_id = '${queryFindFinding.item_check_kanban_id}' 
                                                                and sub_schedule_id = '${queryFindFinding.sub_schedule_id}'
                                                            order by history_item_check_kanban_id desc limit 1`;
                        let queryFindAvailHistory = (await db.query(sqlFindAvailHistory)).rows;
                        if (queryFindAvailHistory.length) {
                            queryFindAvailHistory = queryFindAvailHistory[0];
                            await queryPutTransaction(
                                db,
                                table.tb_r_history_4s_item_check_kanbans,
                                {
                                    kaizen_file: queryFindFinding.kaizen_file,
                                },
                                `where history_item_check_kanban_id = '${queryFindAvailHistory.history_item_check_kanban_id}'`
                            );
                        } else {
                            await queryPostTransaction(
                                db,
                                table.tb_r_history_4s_item_check_kanbans,
                                {
                                    item_check_kanban_id: queryFindFinding.item_check_kanban_id,
                                    sub_schedule_id: queryFindFinding.sub_schedule_id,
                                    kaizen_file: queryFindFinding.kaizen_file,
                                    created_by: req.user.noreg,
                                    created_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
                                }
                            );
                        }*/
                    }
                });

                response.success(res, 'Success to upload 4s kaizen finding', req.body.kaizen_file);
            } catch (error)
            {
                response.failed(res, 'Error to upload 4s kaizen finding ' + error?.message ?? '');
            }
        } catch (error)
        {
            console.log(error);
            response.failed(res, error);
        }
    }
}
