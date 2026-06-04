require('dotenv').config({ path: 'dev.env' });
const { databasePool } = require('./config/database');

async function run() {
    try {
        console.log('Deleting June 2026 schedules...');
        
        // Find main schedule IDs
        const resMainIds = await databasePool.query('SELECT main_schedule_id FROM tb_r_4s_main_schedules WHERE year_num = 2026 AND month_num = 6');
        const mainScheduleIds = resMainIds.rows.map(row => row.main_schedule_id);

        if (mainScheduleIds.length > 0) {
            console.log(`Found ${mainScheduleIds.length} main schedules to delete.`);
            let deletedSubSchedules = 0;
            
            for (let i = 0; i < mainScheduleIds.length; i++) {
                const msId = mainScheduleIds[i];
                console.log(`[${i+1}/${mainScheduleIds.length}] Soft deleting sub-schedules for main_schedule_id: ${msId}...`);
                const delSub = await databasePool.query('UPDATE tb_r_4s_sub_schedules SET deleted_dt = NOW() WHERE main_schedule_id = $1 AND deleted_dt IS NULL', [msId]);
                await databasePool.query('UPDATE tb_r_4s_schedule_sign_checkers SET deleted_dt = NOW() WHERE main_schedule_id = $1 AND deleted_dt IS NULL', [msId]);
                deletedSubSchedules += delSub.rowCount;
            }
            
            console.log(`Soft deleted total ${deletedSubSchedules} sub-schedules. Proceeding to soft delete main schedules...`);
            const res = await databasePool.query('UPDATE tb_r_4s_main_schedules SET deleted_dt = NOW() WHERE year_num = 2026 AND month_num = 6 AND deleted_dt IS NULL');
            console.log('Soft deleted main_schedules:', res.rowCount);
        } else {
            console.log('No main schedules found to soft delete.');
        }
    } catch(e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

run();
