const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })


const moment = require('moment')
const { uuid } = require('uuidv4')
const pg = require('pg')
const table = require('../config/table')
const { queryTransaction } = require('../helpers/query')
const { bulkToSchema } = require('../helpers/schema')
const logger = require('../helpers/logger')
const { shiftByGroupId, nonShift } = require('../services/shift.services')
const { lineGroupRows } = require('../services/common.services')
const {
    genMonthlySubScheduleSchema,
    genMonthlySignCheckerSchema,
    findScheduleTransaction4S,
    findSignCheckerTransaction4S,
    clear4sTransactionRows

} = require('../services/4s.services')

//#region scheduler main
const main = async () => {

    const currentDate = moment()
    const currentMonth = currentDate.month() + 2; // need +2 to determine next month
    const currentYear = currentDate.year()
    const flagCreatedBy = `SCHEDULERS ${currentDate.format('YYYY-MM-DD')}`

    const config = {
        //env: process.env.NODE_ENV,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        host: process.env.DB_HOST,
        ssl: false
    };

    console.log('env', config);
    console.log(`4S Schedule Date Scheduler Running .....`)

    let db;
    try {
        const pool = new pg.Pool({
            ...config,
            application_name: 'easessment-4s-scheduler'
        });
        db = await pool.connect();
        console.log("db connection", db);
        
        //#region schedulers parent
        const lineGroups = await lineGroupRows(db, currentYear, currentMonth, false)

        let mainScheduleBulkSchema = []
        let subScheduleBulkSchema = []
        let signCheckerTl1BulkSchema = []
        let signCheckerTl2BulkSchema = []
        let signChckerGlBulkSchema = []
        let signChckerShBulkSchema = []

        for (let lgIndex = 0; lgIndex < lineGroups.length; lgIndex++) {
            let shiftRows

            if (lineGroups[lgIndex].line_nm.toLowerCase().includes('line')) {
                shiftRows = await shiftByGroupId(db, currentYear, currentMonth, lineGroups[lgIndex].line_id, lineGroups[lgIndex].group_id)
            }
            else {
                shiftRows = await nonShift(db, currentYear, currentMonth)
            }

            //#region scheduler bulk temp var
            const find = await findScheduleTransaction4S(
                db,
                currentYear,
                currentMonth,
                lineGroups[lgIndex].line_id,
                lineGroups[lgIndex].group_id
            )

            if (!find) {
                mainScheduleBulkSchema.push({
                    uuid: uuid(),
                    month_num: lineGroups[lgIndex].month_num,
                    year_num: currentYear,
                    line_id: lineGroups[lgIndex].line_id,
                    group_id: lineGroups[lgIndex].group_id,
                    created_by: flagCreatedBy,
                })
            }

            const subScheduleBulk = await genMonthlySubScheduleSchema(db, currentYear, currentMonth, lineGroups[lgIndex], shiftRows)
            const signCheckers = await genMonthlySignCheckerSchema(db, currentYear, currentMonth, lineGroups[lgIndex], shiftRows)
            const signCheckerTl1 = signCheckers.tl1
            //const signCheckerTl2 = signCheckers.tl2
            const signChckerGl = signCheckers.gl
            const signChckerSh = signCheckers.sh

            if (subScheduleBulk.length > 0) {
                subScheduleBulkSchema.push(...subScheduleBulk)
            }
            if (signCheckerTl1.length > 0) {
                signCheckerTl1BulkSchema.push(...signCheckerTl1)
            }
            /*if (signCheckerTl2.length > 0)
            {
                signCheckerTl2BulkSchema.push(...signCheckerTl2)
            }*/
            if (signChckerGl.length > 0) {
                signChckerGlBulkSchema.push(...signChckerGl)
            }
            if (signChckerSh.length > 0) {
                signChckerShBulkSchema.push(...signChckerSh)
            }
            //#endregion
        }
        //#endregion

        if (mainScheduleBulkSchema.length > 0) {
            const mSchema = await bulkToSchema(mainScheduleBulkSchema)
            await db.query(
                `insert into ${table.tb_r_4s_main_schedules} (${mSchema.columns}) values ${mSchema.values} returning *`)
            console.log('tb_r_4s_main_schedules', 'inserted')
        }

        const mainScheduleInserted = await findScheduleTransaction4S(db, currentYear, currentMonth);
        console.log('subScheduleBulkSchema length', subScheduleBulkSchema.length);
        console.log('signCheckerTl1BulkSchema length', signCheckerTl1BulkSchema.length);
        //console.log('signCheckerTl2BulkSchema length', signCheckerTl2BulkSchema.length);
        console.log('signChckerGlBulkSchema length', signChckerGlBulkSchema.length);
        console.log('signChckerShBulkSchema length', signChckerShBulkSchema.length);

        let countInsertSub = 0
        let countInsertSign = 0

        for (let mIndex = 0; mIndex < mainScheduleInserted.length; mIndex++) {
            //#region scheduler generate main_schedule_id for subScheduleBulkSchema
            if (subScheduleBulkSchema.length > 0) {
                for (let subIndex = 0; subIndex < subScheduleBulkSchema.length; subIndex++) {
                    if (
                        subScheduleBulkSchema[subIndex].line_id == mainScheduleInserted[mIndex].line_id
                        && subScheduleBulkSchema[subIndex].group_id == mainScheduleInserted[mIndex].group_id
                    ) {
                        const checkExisting = await findScheduleTransaction4S(
                            db,
                            currentYear,
                            currentMonth,
                            mainScheduleInserted[mIndex].line_id,
                            mainScheduleInserted[mIndex].group_id,
                            subScheduleBulkSchema[subIndex].freq_id,
                            subScheduleBulkSchema[subIndex].zone_id,
                            subScheduleBulkSchema[subIndex].kanban_id,
                            subScheduleBulkSchema[subIndex].schedule_id
                        )

                        const sSchema = await bulkToSchema([
                            {
                                uuid: uuid(),
                                main_schedule_id: mainScheduleInserted[mIndex].main_schedule_id,
                                kanban_id: subScheduleBulkSchema[subIndex].kanban_id,
                                zone_id: subScheduleBulkSchema[subIndex].zone_id,
                                freq_id: subScheduleBulkSchema[subIndex].freq_id,
                                schedule_id: subScheduleBulkSchema[subIndex].schedule_id,
                                shift_type: subScheduleBulkSchema[subIndex].shift_type,
                                plan_time: subScheduleBulkSchema[subIndex].plan_time,
                                is_holiday: subScheduleBulkSchema[subIndex].is_holiday,
                                created_by: flagCreatedBy,
                            }
                        ])

                        const sqlInSub = `insert into ${table.tb_r_4s_sub_schedules} (${sSchema.columns}) values ${sSchema.values}`

                        if (!checkExisting) {
                            //console.log('sqlInSub', sqlInSub);
                            await db.query(sqlInSub)
                            countInsertSub += 1
                        }
                        else {
                            //console.log('skip sub schedule', subScheduleBulkSchema[subIndex]);
                        }
                    }
                }
            }
            //#endregion

            //#region scheduler combine all sign checker schema
            if (signCheckerTl1BulkSchema.length > 0) {
                for (let tl1Index = 0; tl1Index < signCheckerTl1BulkSchema.length; tl1Index++) {
                    if (
                        signCheckerTl1BulkSchema[tl1Index].group_id == mainScheduleInserted[mIndex].group_id
                        && signCheckerTl1BulkSchema[tl1Index].line_id == mainScheduleInserted[mIndex].line_id
                    ) {
                        const checkExisting = await findSignCheckerTransaction4S(
                            db,
                            currentYear,
                            currentMonth,
                            mainScheduleInserted[mIndex].line_id,
                            mainScheduleInserted[mIndex].group_id,
                            signCheckerTl1BulkSchema[tl1Index].start_date,
                            signCheckerTl1BulkSchema[tl1Index].end_date,
                            true
                        )

                        const sgSchema = await bulkToSchema([
                            {
                                main_schedule_id: mainScheduleInserted[mIndex].main_schedule_id,
                                uuid: uuid(),
                                start_date: signCheckerTl1BulkSchema[tl1Index].start_date,
                                end_date: signCheckerTl1BulkSchema[tl1Index].end_date,
                                is_tl_1: true,
                                is_tl_2: null,
                                is_gl: null,
                                is_sh: null,
                                created_by: flagCreatedBy,
                            }
                        ])

                        const sqlInSign = `insert into ${table.tb_r_4s_schedule_sign_checkers} (${sgSchema.columns}) values ${sgSchema.values}`

                        if (!checkExisting || (checkExisting?.length ?? 0) == 0) {

                            //console.log('sqlInSign', sqlInSign);
                            await db.query(sqlInSign)
                            countInsertSign += 1
                            //console.log('tb_r_4s_schedule_sign_checkers', 'inserted tl1')
                        }
                        else {
                            //console.log('tb_r_4s_schedule_sign_checkers', 'skipped! tl1', sqlInSign)
                        }
                    }
                }
            }

            /*if (signCheckerTl2BulkSchema.length > 0)
            {
                for (let tl2Index = 0; tl2Index < signCheckerTl2BulkSchema.length; tl2Index++)
                {
                    if (
                        signCheckerTl2BulkSchema[tl2Index].group_id == mainScheduleInserted[mIndex].group_id
                        && signCheckerTl2BulkSchema[tl2Index].line_id == mainScheduleInserted[mIndex].line_id
                    )
                    {
                        const checkExisting = await findSignCheckerTransaction4S(
                            db,
                            currentYear,
                            currentMonth,
                            mainScheduleInserted[mIndex].line_id,
                            mainScheduleInserted[mIndex].group_id,
                            signCheckerTl2BulkSchema[tl2Index].start_date,
                            signCheckerTl2BulkSchema[tl2Index].end_date,
                            null,
                            true
                        )

                        const sgSchema = await bulkToSchema([
                            {
                                main_schedule_id: mainScheduleInserted[mIndex].main_schedule_id,
                                uuid: uuid(),
                                start_date: signCheckerTl2BulkSchema[tl2Index].start_date,
                                end_date: signCheckerTl2BulkSchema[tl2Index].end_date,
                                is_tl_1: null,
                                is_tl_2: true,
                                is_gl: null,
                                is_sh: null,
                                created_by: flagCreatedBy,
                            }
                        ])
                        const sqlInSign = `insert into ${table.tb_r_4s_schedule_sign_checkers} (${sgSchema.columns}) values ${sgSchema.values}`

                        if (!checkExisting || (checkExisting?.length ?? 0) == 0)
                        {

                            //console.log('sqlInSign', sqlInSign);
                            await db.query(sqlInSign)
                            countInsertSign += 1
                            //console.log('tb_r_4s_schedule_sign_checkers', 'inserted tl2')
                        }
                        else
                        {
                            //console.log('tb_r_4s_schedule_sign_checkers', 'skipped! tl2', sqlInSign)
                        }
                    }
                }
            }*/

            if (signChckerGlBulkSchema.length > 0) {
                for (let glIndex = 0; glIndex < signChckerGlBulkSchema.length; glIndex++) {
                    if (
                        signChckerGlBulkSchema[glIndex].group_id == mainScheduleInserted[mIndex].group_id
                        && signChckerGlBulkSchema[glIndex].line_id == mainScheduleInserted[mIndex].line_id
                    ) {
                        const checkExisting = await findSignCheckerTransaction4S(
                            db,
                            currentYear,
                            currentMonth,
                            mainScheduleInserted[mIndex].line_id,
                            mainScheduleInserted[mIndex].group_id,
                            signChckerGlBulkSchema[glIndex].start_date,
                            signChckerGlBulkSchema[glIndex].end_date,
                            null,
                            null,
                            true
                        )

                        const sgSchema = await bulkToSchema([
                            {
                                main_schedule_id: mainScheduleInserted[mIndex].main_schedule_id,
                                uuid: uuid(),
                                start_date: signChckerGlBulkSchema[glIndex].start_date,
                                end_date: signChckerGlBulkSchema[glIndex].end_date,
                                is_tl_1: null,
                                is_tl_2: null,
                                is_gl: true,
                                is_sh: null,
                                created_by: flagCreatedBy,
                            }
                        ])
                        const sqlInSign = `insert into ${table.tb_r_4s_schedule_sign_checkers} (${sgSchema.columns}) values ${sgSchema.values}`

                        if (!checkExisting || (checkExisting?.length ?? 0) == 0) {

                            //console.log('sqlInSign', sqlInSign);
                            await db.query(sqlInSign)
                            countInsertSign += 1
                            //console.log('tb_r_4s_schedule_sign_checkers', 'inserted gl')
                        }
                        else {
                            // console.log('tb_r_4s_schedule_sign_checkers', 'skipped! gl', sqlInSign)
                        }
                    }
                }
            }

            if (signChckerShBulkSchema.length > 0) {
                for (let shIndex = 0; shIndex < signChckerShBulkSchema.length; shIndex++) {
                    if (
                        signChckerShBulkSchema[shIndex].group_id == mainScheduleInserted[mIndex].group_id
                        && signChckerShBulkSchema[shIndex].line_id == mainScheduleInserted[mIndex].line_id
                    ) {
                        const checkExisting = await findSignCheckerTransaction4S(
                            db,
                            currentYear,
                            currentMonth,
                            mainScheduleInserted[mIndex].line_id,
                            mainScheduleInserted[mIndex].group_id,
                            signChckerShBulkSchema[shIndex].start_date,
                            signChckerShBulkSchema[shIndex].end_date,
                            null,
                            null,
                            null,
                            true
                        )

                        const sgSchema = await bulkToSchema([
                            {
                                main_schedule_id: mainScheduleInserted[mIndex].main_schedule_id,
                                uuid: uuid(),
                                start_date: signChckerShBulkSchema[shIndex].start_date,
                                end_date: signChckerShBulkSchema[shIndex].end_date,
                                //end_date: `func (select "date" from tb_m_schedules where "date" between '${signChckerShBulkSchema[shIndex].start_date}' and '${signChckerShBulkSchema[shIndex].end_date}' and (is_holiday is null or is_holiday = false) order by schedule_id desc limit 1)`,
                                is_tl_1: null,
                                is_tl_2: null,
                                is_gl: null,
                                is_sh: true,
                                created_by: flagCreatedBy,
                            }
                        ])
                        const sqlInSign = `insert into ${table.tb_r_4s_schedule_sign_checkers} (${sgSchema.columns}) values ${sgSchema.values}`

                        if (!checkExisting || (checkExisting?.length ?? 0) == 0) {

                            //console.log('sqlInSign', sqlInSign);
                            await db.query(sqlInSign)
                            countInsertSign += 1
                            //console.log('tb_r_4s_schedule_sign_checkers', 'inserted sh')
                        }
                        else {
                            //console.log('tb_r_4s_schedule_sign_checkers', 'skipped! sh', sqlInSign)
                        }
                    }
                }
            }
            //#endregion
        }

        console.log('countinsert sub', countInsertSub);
        console.log('countinsert sign', countInsertSign);
        logger(`successfully run 4s.scheduler for month=${currentMonth}-${currentYear}`)
    } catch (error) {
        console.log('error 4s generate schedule, scheduler running', error)
        logger(`error clear4sTransactionRows() 4s.scheduler for month=${currentMonth}-${currentYear}`, error)
        await clear4sTransactionRows(db, flagCreatedBy)

        console.log('error final 4s generate schedule, scheduler running', error);
        logger(`error 4s.scheduler for month=${currentMonth}-${currentYear}`, error);
        //process.exit();
    } finally {
        if (db) {
            db.release();
        }
    }

}
//#endregion
// main()


/* clear4sRows()
    .then((r) => 0)
    .catch((e) => 0) */

/* clear4sRows()
    .then((r) => {
        main()
            .then((r) => {
                logger(`success run scheduler for month=${currentMonth}-${currentYear}`)
                return 0
            })
            .catch((e) => {
                logger(`error clear4sRows() 4s.scheduler for month=${currentMonth}-${currentYear}`, {
                    data: e
                })
                return 0
            })
    })
    .catch((e) => {
        logger(`error clear4sRows() 4s.scheduler for month=${currentMonth}-${currentYear}`, {
            data: e
        })
        return 0
    }) */

/* main()
    .then(() => {
        console.log("scheduler finish!");

        process.exit()
    })
    .catch((error) => {
        console.log('error', error);
        process.exit()
    }) */

module.exports = main
