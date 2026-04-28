const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({path: envFilePath})

const {uuid} = require('uuidv4');
const {database} = require('../../config/database');
const table = require('../../config/table')
const {totalDaysOfYear} = require('../../helpers/date')
const path = require('path');
const {readFile} = require('fs/promises');
const {cleanString} = require('../../helpers/formatting')
const {createNewKanbanSingleLineSchedule, genMonthlySubScheduleSchema, mapSchemaPlanKanban4S} = require("../../services/4s.services")

const fs = require('fs');

console.log('env', {
    env: process.env.NODE_ENV,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false
})

console.log(`Migration Running ...`)

const flagCreatedBy = 'SEEDER CamShaft 15012025 01'

/**
 * Clears all rows from the specified tables in the database.
 *
 * @param {database} db - The database connection object.
 * @return {Promise<void>} A promise that resolves when all rows have been cleared.
 */
const clearRows = async (db = database) => {
    console.log('clearing start')
    //await db.query(`SET session_replication_role = 'replica'`)

    //#region clear transaction with flag
    {
        await db.query(`DELETE FROM ${table.tb_r_4s_schedule_sign_checkers} WHERE created_by = '${flagCreatedBy}'`)
        const lastTransSignChecker = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_4s_schedule_sign_checkers} ORDER BY sign_checker_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_r_4s_schedule_sign_checkers} ALTER COLUMN sign_checker_id RESTART WITH ${(lastTransSignChecker.rows[0]?.sign_checker_id ?? 0) + 1}`)

        await db.query(`DELETE FROM ${table.tb_r_4s_sub_schedules} WHERE created_by = '${flagCreatedBy}'`)
        const lastTransSubSchedule = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_4s_sub_schedules} ORDER BY sub_schedule_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_r_4s_sub_schedules} ALTER COLUMN sub_schedule_id RESTART WITH ${(lastTransSubSchedule.rows[0]?.sub_schedule_id ?? 0) + 1}`)

        await db.query(`DELETE FROM ${table.tb_r_4s_main_schedules} WHERE created_by = '${flagCreatedBy}'`)
        const lastTransMainSchedule = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_4s_main_schedules} ORDER BY main_schedule_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_r_4s_main_schedules} ALTER COLUMN main_schedule_id RESTART WITH ${(lastTransMainSchedule.rows[0]?.main_schedule_id ?? 0) + 1}`)
    }
    //#endregion

    //await db.query(`SET session_replication_role = 'origin'`)
    console.log('clear rows completed')
}

function writeToFile(json) {
    const dir = `${process.cwd()}/logs`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }

    const file = `${dir}/log-${flagCreatedBy.replaceAll(" ", "-")}.log`;
    /*let data;
    if (fs.existsSync(file)) {
        data = fs.readFileSync(file, 'utf8');
    }

    if (!data) {
        data = [];
    } else {
        data = JSON.parse(data);
    }

    data.push(json);*/

    fs.writeFileSync(file, JSON.stringify(json, null, 2))
}

const main = async () => {
    const db = database
    db.connect((e) => {

    })

    try {
        await clearRows(db)

        const yearMonth = [
            '2024-09',
            '2024-10',
            '2024-11',
            '2024-12',
            '2025-01'
        ];

        const logs = [];

        for (let i = 0; i < yearMonth.length; i++) {
            const [year, month] = yearMonth[i].split("-");

            const logObj = {
                yearMonth: yearMonth[i],
                kanbans: [],
            };

            const kanbanSql = `select
                                    tmk.kanban_id,
                                    tmz.zone_id,
                                    tmf.freq_id,
                                    tmg.group_id,
                                    tml.line_id,
                                    tmk.kanban_no,
                                    tmz.zone_nm,
                                    tmf.freq_nm,
                                    tml.line_nm,
                                    tmf.precition_val
                                from
                                    tb_m_kanbans tmk
                                        join public.tb_m_zones tmz on tmk.zone_id = tmz.zone_id
                                        join public.tb_m_freqs tmf on tmk.freq_id = tmf.freq_id
                                        join public.tb_m_lines tml on tmz.line_id = tml.line_id
                                        join public.tb_m_groups tmg on tmk.group_id = tmg.group_id
                                where
                                    tml.line_nm = 'Cam Shaft'`;
            const kanbanQuery = (await db.query(kanbanSql)).rows;
            for (let j = 0; j < kanbanQuery.length; j++) {
                const kanban = kanbanQuery[j];

                /*const subSchedule = await mapSchemaPlanKanban4S(
                    db,
                    kanban.line_id,
                    kanban.group_id,
                    kanban.precition_val,
                    kanban.freq_id,
                    kanban.zone_id,
                    kanban.kanban_id,
                    parseInt(month), // current month, date js is - 1 from actual month
                    parseInt(year),
                    null,
                    true
                );

                logObj.kanbans.push(subSchedule);*/

                 await createNewKanbanSingleLineSchedule(
                     db,
                     kanban.line_id,
                     kanban.group_id,
                     kanban.precition_val,
                     kanban.freq_id,
                     kanban.zone_id,
                     kanban.kanban_id,
                     month, // current month, date js is - 1 from actual month
                     year,
                     null,
                     flagCreatedBy
                 );
            }

            //logs.push(logObj);
        }

        //writeToFile(logs);
        //await itemCheck4sSeeder(db)
        console.info('Seeder Completed!!!')
    } catch (error) {
        await clearRows()
        console.error(error)
        console.info('Seeder ERROR!!!')
    } finally {
        db.end((e) => {
            if (e) {
                console.log('error end db', e);
            }
        })
    }
}


//writeToFile();

main()
    .then((r) => process.exit())
    .catch((e) => {
        console.log('error', e);
        process.exit()
    });
//clearRows().then((r) => process.exit()).catch((e) => process.exit())
