const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const { uuid } = require('uuidv4');
const table = require('../../config/table')
const moment = require('moment')
const { queryTransaction } = require('../../helpers/query')
const { bulkToSchema } = require('../../helpers/schema')

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

const migrate = async () => {
    const clearRows = async (db) => {
        console.log('clearing start')
        await db.query(`SET session_replication_role = 'replica'`)

        await db.query(`DELETE FROM ${table.tb_r_4s_schedule_item_check_kanbans} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_r_4s_schedule_item_check_kanbans} ALTER COLUMN schedule_item_check_kanban_id RESTART WITH 1`)

        await db.query(`DELETE FROM ${table.tb_r_4s_findings} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_r_4s_findings} ALTER COLUMN finding_id RESTART WITH 1`)

        await db.query(`SET session_replication_role = 'origin'`)
        console.log('clearing succeed')
    }

    await queryTransaction(async (db) => {
        await clearRows(db)

        const mst = await db.query(
            `
                select distinct on (tmk.kanban_id, tmf.freq_id, tmz.zone_id)
                    tm4sick.item_check_kanban_id,
                    tmk.kanban_id,
                    tmf.freq_id,
                    tmz.zone_id,
                    tmz.line_id,
                    users.user_id,
                    tm4sick.item_check_nm,
                    tmf.freq_nm,
                    tmz.zone_nm,
                    schedule.date
                from
                    tb_m_4s_item_check_kanbans tm4sick
                        join tb_m_kanbans tmk on tm4sick.kanban_id = tmk.kanban_id
                        join tb_m_freqs tmf on tmk.freq_id = tmf.freq_id
                        join tb_m_zones tmz on tmk.zone_id = tmz.zone_id
                        left join lateral (
                            select
                                tms.date
                            from
                                tb_r_4s_sub_schedules tr4sss
                                    join tb_m_schedules tms on tr4sss.schedule_id = tms.schedule_id
                            where
                                main_schedule_id = 1
                            and tr4sss.freq_id = tmf.freq_id
                            and tr4sss.zone_id = tmz.zone_id
                            and tr4sss.kanban_id = tmk.kanban_id
                            and tr4sss.shift_type != 'night_shift'
                            limit 1
                            ) schedule on true,
                        (
                            select *
                            from tb_m_users
                            limit 1
                        ) users
                where
                        tmk.kanban_id in (
                                            select
                                                tb_r_4s_sub_schedules.kanban_id
                                            from
                                                tb_r_4s_sub_schedules
                                            where
                                                main_schedule_id = 1
                                            group by tb_r_4s_sub_schedules.kanban_id
                                        )
                and   tmf.freq_id in (
                                        select
                                            tb_r_4s_sub_schedules.freq_id
                                        from
                                            tb_r_4s_sub_schedules
                                        where
                                            main_schedule_id = 1
                                        group by tb_r_4s_sub_schedules.freq_id
                                    )
                and   tmz.zone_id in (
                                        select
                                            tb_r_4s_sub_schedules.zone_id
                                        from
                                            tb_r_4s_sub_schedules
                                        where
                                            main_schedule_id = 1
                                        group by tb_r_4s_sub_schedules.zone_id
                                    )
                limit 3
            `
        )

        const trItemCheck = []
        const trItemCheckToFinding = []
        mst.rows.forEach((item) => {
            trItemCheckToFinding.push({
                kanban_id: item.kanban_id,
                freq_id: item.freq_id,
                zone_id: item.zone_id,
                line_id: item.line_id,
                user_id: item.user_id,
                date: item.date
            })

            trItemCheck.push({
                uuid: uuid(),
                main_schedule_id: 1,
                item_check_kanban_id: item.item_check_kanban_id,
                judgment_id: 2,
                actual_time: 5,
            })
        })

        const itemCheckSchema = await bulkToSchema(trItemCheck)
        const itemCheckRows = await db.query(`insert into ${table.tb_r_4s_schedule_item_check_kanbans} (${itemCheckSchema.columns}) VALUES ${itemCheckSchema.values} returning *`)
        console.log('tb_r_4s_schedule_item_check_kanbans', 'inserted');

        trItemCheckToFinding.map((item, i) => {
            item.schedule_item_check_kanban_id = itemCheckRows.rows[i].schedule_item_check_kanban_id

            return item
        })

        const trFinding = []
        trItemCheckToFinding.forEach((item) => {
            trFinding.push({
                uuid: uuid(),
                schedule_item_check_kanban_id: item.schedule_item_check_kanban_id,
                line_id: item.line_id,
                freq_id: item.freq_id,
                zone_id: item.zone_id,
                kanban_id: item.kanban_id,
                finding_pic_id: item.user_id,
                actual_pic_id: item.user_id,
                finding_date: item.date,
                finding_desc: 'this is finding from seeder',
                plan_cm_date: moment(item.date, 'YYYY-MM-DD').add('1', 'd').format('YYYY-MM-DD'),
                plan_cm_desc: 'this is plan from seeder',
                actual_cm_date: moment(item.date, 'YYYY-MM-DD').add('1', 'd').format('YYYY-MM-DD'),
                time_cm: 5,
                time_yokoten: true,
                opt_changes: 'Perubahan Item Check; Perubahan Kanban',
                opt_depts: 'Produksi; Kaizen',
                evaluation_nm: 'Countermeasure',
                cm_judg: true,
            })
        })

        const findingSchema = await bulkToSchema(trFinding)
        await db.query(`insert into ${table.tb_r_4s_findings} (${findingSchema.columns}) VALUES ${findingSchema.values} returning *`)
        console.log('tb_r_4s_findings', 'inserted')

        console.log('Seeder Completed!!!')
    }).then((res) => {
        return 0
    }).catch((err) => {
        console.log('error migrate', err);
        return 0
    })
}

migrate()