const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({path: envFilePath})

const {uuid} = require('uuidv4');
const {database} = require('../../config/database');
const {totalDaysOfYear} = require('../../helpers/date')
const {readFile} = require('fs/promises');
const {cleanString} = require('../../helpers/formatting');
const {queryCustom} = require("../../helpers/query");
const {genMonthlySignCheckerSchema, findScheduleTransaction4S} = require("../../services/4s.services");
const {bulkToSchema} = require("../../helpers/schema");
const freqServices = require("../../services/freq.services");

const path = require('path');
const table = require('../../config/table');
const moment = require("moment");
const formatting = require("../../helpers/formatting");
const _4Service = require("../../services/4s.services");

const now = moment();
const flagCreatedBy = `Injection CrankShaft ${now.format('YYYY-MM-DD HH:mm')} 03`;
const generatedMonth = 11;

console.log('env', {
    env: process.env.NODE_ENV,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false
});

console.log(`Injection Running ...`);

const main = async () => {
    const db = database;
    db.connect((e) => {

    });

    try {
        const lineQuery = await db.query(`select * from tb_m_lines where line_nm in ('Crank Shaft') and deleted_dt is null limit 1`)
        const lineRow = lineQuery.rows[0]


        const sql = (
            {
                isItemCheck = false,
                kanbanName,
                itemCheckName,
                others = null
            } = {}
        ) => {
            return `select
                        tmk.kanban_id,
                        tmf.freq_id,
                        tmz.zone_id,
                        tmg.group_id,
                        tml.line_id,
                        tml.line_nm,
                        tmf.freq_nm,
                        tmz.zone_nm,
                        tmk.kanban_no,
                        ${isItemCheck ? 'tm4sick.item_check_kanban_id,' : ''}
                        ${isItemCheck ? 'tm4sick.item_check_nm,' : ''}
                        tmg.group_nm,
                        tmf.precition_val
                    from
                        ${isItemCheck ? 'tb_m_4s_item_check_kanbans tm4sick join public.tb_m_kanbans tmk on tm4sick.kanban_id = tmk.kanban_id' : 'public.tb_m_kanbans tmk'}
                            join public.tb_m_zones tmz on tmk.zone_id = tmz.zone_id
                            join public.tb_m_lines tml on tmz.line_id = tml.line_id
                            join public.tb_m_freqs tmf on tmk.freq_id = tmf.freq_id
                            join public.tb_m_groups tmg on tmk.group_id = tmg.group_id
                    where
                          tml.line_id = ${lineRow.line_id}
                          ${isItemCheck && itemCheckName ? `and lower(tm4sick.item_check_nm) = '${itemCheckName.toLowerCase()}'` : ''}
                          ${kanbanName ? `and lower(tmk.kanban_no) = '${kanbanName.toLowerCase()}'` : ''}
                          ${others ? others : ''}`;
        };

        const randomUserIdSql = () => {
            return `select *
                    from
                        (
                            select distinct
                                user_id
                            from
                                tb_m_users
                            where
                                deleted_dt is null
                        ) users
                    ORDER BY
                        random()
                    limit 1;`;
        };

        const commonInObj = {
            created_by: flagCreatedBy,
            created_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
            changed_by: flagCreatedBy,
            changed_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
        };

        const whereSubScheduleRaw = (subSchedule) => {
            return `main_schedule_id = ${subSchedule.main_schedule_id}
                     and kanban_id = ${subSchedule.kanban_id}
                     and zone_id = ${subSchedule.zone_id}
                     and freq_id = ${subSchedule.freq_id}
                     and schedule_id = ${subSchedule.schedule_id}`;
        }

        const deleteExisting = async (scheduleArr) => {
            for (let j = 0; j < scheduleArr.length; j++) {
                const delSql = `delete from ${table.tb_r_4s_sub_schedules} where ${whereSubScheduleRaw(scheduleArr[j])}`;
                await db.query(delSql);
            }
        }

        const json = JSON.parse(await readFile(path.resolve(__dirname, '../json/Transaction_112024_4sCrankShaft_20112024.json'), "utf8"));

        // generate grouped by kanban no/name, this should distinct from duplicated item check generated json
        const groupedKanbans = formatting.arrayObjectGroupBy(json, 'No Kanban');
        const kanbanNames = Object.keys(groupedKanbans);

        //region iterate over kanban grouped
        for (let i = 0; i < kanbanNames.length; i++) {
            //region find kanban and should validated
            const kanbanSql = sql({
                isItemCheck: false,
                kanbanName: kanbanNames[i],
                others: `and lower(tmz.zone_nm) = '${groupedKanbans[kanbanNames[i]][0]['Zone'].toLowerCase()}'`,
            });

            let kanbanQuery = await db.query(kanbanSql);

            if (kanbanQuery.rowCount === 0) {
                console.log('kanban not exists', kanbanNames[i]);
                continue;
            }

            kanbanQuery = kanbanQuery.rows[0];
            //endregion

            //region find freq name/period from json excel ds and should validated
            const freqNameRaw = groupedKanbans[kanbanNames[i]][0]['Periode'];
            const freq = await freqServices.query.findFreqByRaw(db, {
                period: freqNameRaw,
                insertData: {
                    ...commonInObj,
                },
            });

            if (!freq) {
                throw {
                    freqRaw: freqNameRaw,
                    message: 'freq not inserted or not found',
                };
            }

            kanbanQuery.freq_id = freq.freq_id;
            kanbanQuery.precition_val = freq.precition_val;
            //endregion


            //region generate schedule
            //region main_schedule
            let mainSchedule = await findScheduleTransaction4S(
                db,
                2024,
                generatedMonth,
                kanbanQuery.line_id,
                kanbanQuery.group_id,
                null,
                null,
                null
            );

            if (!mainSchedule) {
                const mSchema = await bulkToSchema({
                    uuid: uuid(),
                    month_num: generatedMonth,
                    year_num: 2024,
                    line_id: kanbanQuery.line_id,
                    group_id: kanbanQuery.group_id,
                    ...commonInObj,
                });

                const mainScheduleQuery = await db.query(
                    `insert into ${table.tb_r_4s_main_schedules} (${mSchema.columns}) values ${mSchema.values} returning *`);

                mainSchedule = mainScheduleQuery.rows[0];
            } else {
                mainSchedule = mainSchedule[0];
            }
            //endregion

            const kanbanRow = {
                precition_val: kanbanQuery.precition_val,
                kanban_id: kanbanQuery.kanban_id,
                freq_id: kanbanQuery.freq_id,
                zone_id: kanbanQuery.zone_id,
            };

            let subSchedulesHasPlanCheck = [];

            //region find random user id to determine planning pic and actual pic
            const randomUserQuery = (await db.query(randomUserIdSql())).rows[0];
            //endregion

            //region mapped insert values for both schedule >= month or < month
            const scheduleInObj = (schedule) => {
                return {
                    uuid: uuid(),
                    main_schedule_id: mainSchedule.main_schedule_id,
                    pic_id: randomUserQuery.user_id,
                    actual_time: schedule.plan_time,
                    actual_pic_id: randomUserQuery.user_id,
                    ...commonInObj,
                };
            };
            //endregion

            //region generated Less Than Month schedule (if match an precition value from freq)
            let leMonth = await _4Service.genLessThanMonth(
                db,
                kanbanRow,
                [],
                generatedMonth,
                2024,
                kanbanQuery.line_id,
                kanbanQuery.group_id,
                true
            );
            if (leMonth.length) {
                await deleteExisting(leMonth);

                leMonth = leMonth.map((item) => {
                    delete item.group_id;
                    delete item.line_id;

                    return {
                        ...item,
                        ...scheduleInObj(item)
                    };
                });

                const schema = await bulkToSchema(leMonth);
                const sqlInSub = `insert into ${table.tb_r_4s_sub_schedules} (${schema.columns}) values ${schema.values} returning *`;
                const inserted = (await db.query(sqlInSub)).rows;
                subSchedulesHasPlanCheck = leMonth.filter((item) => {
                    return item.plan_time;
                });
            }
            //endregion

            //region generated Greater than month schedule (if match an precition value from freq)
            let geMonth = await _4Service.genMonthlySchedulePlan(
                db,
                kanbanRow,
                [],
                kanbanQuery.line_id,
                kanbanQuery.group_id,
                generatedMonth,
                2024,
                true
            );
            if (geMonth.length) {
                await deleteExisting(geMonth);

                geMonth = geMonth.map((item) => {
                    delete item.group_id;
                    delete item.line_id;

                    return {
                        ...item,
                        ...scheduleInObj(item)
                    };
                });

                const schema = await bulkToSchema(geMonth);
                const sqlInSub = `insert into ${table.tb_r_4s_sub_schedules} (${schema.columns}) values ${schema.values} returning *`;
                const inserted = (await db.query(sqlInSub)).rows;
                subSchedulesHasPlanCheck = geMonth.filter((item) => {
                    return item.plan_time;
                });
            }
            //endregion

            //region generate less than month and greater than 1 & 2 day (WEEKLY TEMPORARY)
            let weekly = await _4Service.genWeeklySchedulePlan(
                db,
                kanbanRow,
                [],
                generatedMonth,
                2024,
                kanbanQuery.line_id,
                kanbanQuery.group_id,
                true
            );
            if (weekly.length) {
                await deleteExisting(weekly);

                weekly = weekly.map((item) => {
                    delete item.group_id;
                    delete item.line_id;

                    return {
                        ...item,
                        ...scheduleInObj(item)
                    };
                });

                const schema = await bulkToSchema(weekly);
                const sqlInSub = `insert into ${table.tb_r_4s_sub_schedules} (${schema.columns}) values ${schema.values} returning *`;
                const inserted = (await db.query(sqlInSub)).rows;
                subSchedulesHasPlanCheck = weekly.filter((item) => {
                    return item.plan_time;
                });
            }
            //endregion

            //region generated sign_checker, this func has been validate, if exists the sign checker should not be generated
            const signCheckers = await _4Service.genMonthlySignCheckerSchema(
                db,
                2024,
                generatedMonth,
                {
                    line_id: kanbanQuery.line_id,
                    group_id: kanbanQuery.group_id
                },
                []
            );
            //endregion
            //endregion

            //region generate actual checker
            if (subSchedulesHasPlanCheck.length) {
                for (let j = 0; j < groupedKanbans[kanbanNames[i]].length; j++) {
                    const itemCheckSql = sql({
                        isItemCheck: true,
                        itemCheckName: groupedKanbans[kanbanNames[i]][j]['Item Check Kanban']
                    });

                    let itemCheckQuery = (await db.query(itemCheckSql)).rows;
                    if (!itemCheckQuery.length) {

                    } else {
                        itemCheckQuery = itemCheckQuery[0];
                        //const checkers = [];

                        for (let k = 0; k < subSchedulesHasPlanCheck.length; k++) {
                            const scheduleItemCheckKanbans = {
                                uuid: uuid(),
                                main_schedule_id: mainSchedule.main_schedule_id,
                                item_check_kanban_id: itemCheckQuery.item_check_kanban_id,
                                judgment_id: 1,
                                actual_time: groupedKanbans[kanbanNames[i]][j]['Time'],
                                checked_date: subSchedulesHasPlanCheck[k].plan_time,
                                sub_schedule_id: `( select sub_schedule_id from ${table.tb_r_4s_sub_schedules} where ${whereSubScheduleRaw(subSchedulesHasPlanCheck[k])} )`,
                                ...commonInObj,
                            };

                            //checkers.push(scheduleItemCheckKanbans);

                            const schema = await bulkToSchema([scheduleItemCheckKanbans]);
                            const sqlInSub = `insert into ${table.tb_r_4s_schedule_item_check_kanbans} (${schema.columns}) values ${schema.values} returning *`;
                            console.log(sqlInSub);
                            const inserted = (await db.query(sqlInSub)).rows;
                        }

                        /*if (checkers.length) {

                        }*/
                    }
                }
            }
            //endregion
        }
        //endregion

        const rawNotListedSchedule = `s`;

    } catch (e) {
        throw e;
    }
};

const mainUpdateItemCheckNotGenerated = async () => {
    const db = database;
    db.connect((e) => {

    });

    try {
        const flagCreatedBy = `Injection Update CrankShaft ${now.format('YYYY-MM-DD HH:mm')} 01`;
        const sqlItemCheck4S = `select
                                            tr4sms.main_schedule_id,
                                            tr4sss.sub_schedule_id,
                                            tr4sss.schedule_id,
                                            tr4sss.plan_time,
                                            tr4sss.actual_time,
                                            tm4sick.item_check_kanban_id,
                                            tmk.kanban_id,
                                            tm4sick.item_check_nm,
                                            tmk.kanban_no,
                                            tm4sick.standart_time
                                        from
                                            tb_m_4s_item_check_kanbans tm4sick
                                                join public.tb_m_kanbans tmk on tm4sick.kanban_id = tmk.kanban_id
                                                join public.tb_r_4s_sub_schedules tr4sss on tmk.kanban_id = tr4sss.kanban_id
                                                join public.tb_r_4s_main_schedules tr4sms on tr4sss.main_schedule_id = tr4sms.main_schedule_id
                                        where
                                              tr4sms.month_num in (9, 10, 11)
                                          and tr4sms.year_num = 2024
                                          and tr4sms.line_id = 6
                                          and plan_time is not null`;

        const queryItemCheck4S = (await db.query(sqlItemCheck4S)).rows;
        for (let i = 0; i < queryItemCheck4S.length; i++) {
            const sqlFindExists = `select 
                                            * 
                                           from 
                                                ${table.tb_r_4s_schedule_item_check_kanbans} 
                                           where 
                                                sub_schedule_id = ${queryItemCheck4S[i].schedule_id} 
                                                and main_schedule_id = ${queryItemCheck4S[i].main_schedule_id}
                                                and item_check_kanban_id = ${queryItemCheck4S[i].item_check_kanban_id}`;

            const queryFindExists = (await db.query(sqlFindExists)).rows;
            if (!queryFindExists.rowCount) {
                const schema = await bulkToSchema([{
                    uuid: uuid(),
                    main_schedule_id: queryItemCheck4S[i].main_schedule_id,
                    item_check_kanban_id: queryItemCheck4S[i].item_check_kanban_id,
                    judgment_id: 1,
                    actual_time: queryItemCheck4S[i].standart_time,
                    checked_date: queryItemCheck4S[i].plan_time,
                    sub_schedule_id: queryItemCheck4S[i].sub_schedule_id,
                    created_by: flagCreatedBy,
                    changed_by: flagCreatedBy,
                    created_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
                    changed_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
                }]);

                const sqlInSub = `insert into ${table.tb_r_4s_schedule_item_check_kanbans} (${schema.columns}) values ${schema.values} returning *`;
                console.log(sqlInSub);
                await db.query(sqlInSub);
            }
        }
    } catch (e) {
        throw e;
    }
};

/*
mainUpdateItemCheckNotGenerated()
    .then((r) => {
        console.log('successfully generated');
        process.exit();
    })
    .catch((e) => {
        console.log('error generated', e);
        process.exit()
    });*/
