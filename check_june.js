require('dotenv').config({ path: 'dev.env' });
const { databasePool } = require('./config/database');

async function run() {
    try {
        const res = await databasePool.query('SELECT count(*) FROM tb_r_4s_sub_schedules WHERE main_schedule_id IN (SELECT main_schedule_id FROM tb_r_4s_main_schedules WHERE year_num = 2026 AND month_num = 6)');
        console.log('Sub schedules count:', res.rows[0].count);
    } catch(e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
