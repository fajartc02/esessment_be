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

const path = require('path');
const table = require('../../config/table');
const moment = require("moment");
const formatting = require("../../helpers/formatting");
const _4Service = require("../../services/4s.services");

const now = moment();
const flagCreatedBy = `Injection CrankShaft ${now.format('YYYY-MM-DD HH:mm')} 01`;

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

        /*{
                "Date Update": "08/01/2024",
                "Zone": "Zone 1",
                "No Kanban": "C - 02 - 01",
                "Area": "Oil Pan, shuter, & Lifter sliper",
                "Item Check Kanban": "Oil Pan",
                "Metode 4S": "Cleaning (menit)",
                "Control Point": "Control Point",
                "Time": 5,
                "Periode": "2D",
                "Group": "WHITE",
                "Total Waktu 4S": 10,
                "Actual Check": "06/01/2024"
            },*/

        const sql = (
            {
                isItemCheck = false,
                kanbanName,
                itemCheckName,
            } = {}
        ) => {
            return `select
                        tmk.kanban_id,
                        tmf.freq_id,
                        tmz.zone_id,
                        tmg.group_id,
                        tml.line_nm,
                        tmf.freq_nm,
                        tmz.zone_nm,
                        tmk.kanban_no,
                        ${isItemCheck ? 'tm4sick.item_check_id,' : ''}
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
                          ${kanbanName ? `and lower(tmk.kanban_no) = '${kanbanName.toLowerCase()}'` : ''}`;
        };

        const json = JSON.parse(await readFile(path.resolve(__dirname, '../json/Transaction_4sCrankShaft_15112024.json'), "utf8"));
        const kanbanNames = Object.keys(formatting.arrayObjectGroupBy(json, 'No Kanban'));

        for (let i = 0; i < kanbanNames.length; i++) {
            const kanbanSql = sql({
                isItemCheck: false,
                kanbanName: kanbanNames[i]
            });

            const kanbanQuery = await db.query(kanbanSql);

            if (kanbanQuery.rowCount === 0) {
                console.log('kanban not exists', kanbanNames[i]);
                continue;
            }

            //region generate schedule
            //region main_schedule
            let mainSchedule = await findScheduleTransaction4S(
                db,
                2024,
                null,
                kanbanQuery.line_id,
                kanbanQuery.group_id,
                kanbanQuery.freq_id,
                kanbanQuery.zone_id,
                kanbanQuery.kanban_id
            );

            if (!mainSchedule) {
                const mSchema = await bulkToSchema({
                    uuid: uuid(),
                    month_num: null,
                    year_num: 2024,
                    line_id: kanbanQuery.line_id,
                    group_id: kanbanQuery.group_id,
                    created_by: flagCreatedBy,
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

            //region Less Than Month
            let leMonth = await _4Service.genLessThanMonth(
                db,
                kanbanRow,
                [],
                null,
                2024,
                kanbanQuery.line_id,
                kanbanQuery.group_id,
                true
            );

            if (leMonth.length) {
                leMonth = leMonth.map((item) => {
                    return {
                        ...item,
                        main_schedule_id: mainSchedule.main_schedule_id,
                        pic_id: null,
                        actual_check_dt: null,
                        actual_pic_id: null
                    };
                });
            }
            //endregion

            //region Greater than month
            const geMonth = _4Service.genMonthlySchedulePlan(
                db,
                kanbanRow,
                [],
                kanbanQuery.line_id,
                kanbanQuery.group_id,
                null,
                2024,
                true
            );
            //endregion

            //region sign_checker
            const signCheckers = await _4Service.genMonthlySignCheckerSchema(
                db,
                2024,
                null,
                {
                    line_id: kanbanQuery.line_id,
                    group_id: kanbanQuery.group_id
                },
                []
            );
            //endregion
            //endregion

            //region generate actual checker
            for (let i = 0; i < json.length; i++) {
                const itemCheckSql = sql({
                    isItemCheck: true,
                    itemCheckName: json[i]['Item Check Kanban']
                });

                let itemCheckQuery = (await db.query(itemCheckSql)).rows;
                if (!itemCheckQuery.length) {

                } else {
                    itemCheckQuery = itemCheckQuery[0];


                }
            }
            //endregion

        }

    } catch (e) {
        throw e;
    }
};

main()
    .then((r) => {
        console.log('successfully generated');
        process.exit();
    })
    .catch((e) => {
        console.log('error generated', e);
        process.exit()
    });