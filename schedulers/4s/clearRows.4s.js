/**
 * 
 * @param {Pg.Pool} databasePool 
 */
module.exports = async (databasePool) => {
    if (process.env.NODE_ENV.trim() == 'dev' || process.env.NODE_ENV.trim() == 'local')
    {
        console.log('clearing start')
        await databasePool.query(`SET session_replication_role = 'replica'`)

        await databasePool.query(`DELETE FROM ${table.tb_r_4s_main_schedules} CASCADE`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_4s_main_schedules} ALTER COLUMN main_schedule_id RESTART WITH 1`)

        await databasePool.query(`DELETE FROM ${table.tb_r_4s_sub_schedules} CASCADE`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_4s_sub_schedules} ALTER COLUMN sub_schedule_id RESTART WITH 1`)

        await databasePool.query(`DELETE FROM ${table.tb_r_4s_schedule_sign_checkers} CASCADE`)
        await databasePool.query(`ALTER TABLE ${table.tb_r_4s_schedule_sign_checkers} ALTER COLUMN sign_checker_id RESTART WITH 1`)

        await databasePool.query(`SET session_replication_role = 'origin'`)
        console.log('clearing succeed')
    }
}