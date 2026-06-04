require('dotenv').config({ path: 'dev.env' });
const { databasePool } = require('./config/database');

async function main() {
    try {
        const lineId = 4; // Die Casting
        const groupId = 3; // WHITE

        console.log("\n=== C-01-19 history ===");
        const c0119 = await databasePool.query(`
            SELECT m.month_num, ss.plan_time
            FROM tb_r_4s_main_schedules m
            JOIN tb_r_4s_sub_schedules ss ON m.main_schedule_id = ss.main_schedule_id
            JOIN tb_m_kanbans k ON ss.kanban_id = k.kanban_id
            WHERE m.line_id = $1
              AND m.group_id = $2
              AND m.year_num = 2026
              AND k.kanban_no = 'C-01-19'
              AND m.deleted_dt IS NULL
              AND ss.plan_time IS NOT NULL
              AND ss.deleted_dt IS NULL
            ORDER BY m.month_num
        `, [lineId, groupId]);
        console.table(c0119.rows);
        
        // dates removed
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
main();
