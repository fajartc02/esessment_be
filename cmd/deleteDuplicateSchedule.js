const nodeEnv = (process.env.NODE_ENV || 'local').trim()
const envFilePath = nodeEnv == 'production'
    ? './.env'
    : (nodeEnv == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const pg = require('pg')

//#region scheduler main
const main = async () => {
    const config = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        host: process.env.DB_HOST,
        ssl: false,
        application_name: 'delete-duplicate-schedule-script'
    };

    console.log('env', config);

    let client = null;
    try {
        const pool = new pg.Pool(config);
        client = await pool.connect();

        let limit = 100;
        const dateStart = "2026-01-01", dateEnd = "2026-12-31";

        const rawSqlCount = `select count(*) as count_duplicates
                                from (SELECT schedule_id,
                                            date,
                                            ROW_NUMBER() OVER (
                                                PARTITION BY "date"
                                                ORDER BY schedule_id
                                                ) as rnk
                                        FROM tb_m_schedules
                                        WHERE "date" >= '${dateStart}'
                                        AND "date" <= '${dateEnd}'
                                        order by date) a
                                where rnk > 1`;
        console.log(`executed count duplicatedRows`, rawSqlCount);

        const resCount = await client.query(rawSqlCount);
        const countDuplicates = parseInt(resCount.rows[0].count_duplicates);
        console.log(`Total duplicate schedules between ${dateStart} and ${dateEnd}: ${countDuplicates}`);

        const rawSqlDelete = `delete
                                from tb_m_schedules
                                where schedule_id in (select schedule_id
                                                    from (SELECT schedule_id,
                                                                date,
                                                                ROW_NUMBER() OVER (
                                                                    PARTITION BY "date"
                                                                    ORDER BY schedule_id
                                                                    ) as rnk
                                                            FROM tb_m_schedules
                                                            WHERE "date" >= '${dateStart}'
                                                            AND "date" <= '${dateEnd}'
                                                            order by date) a
                                                    where rnk > 1 limit ${limit})`;
        console.log(`executed deleteDuplicateRows`, rawSqlDelete);

        for (let offset = 0; offset < countDuplicates; offset++) {
            const resDelete = await client.query(rawSqlDelete);
            console.log(`Deleted ${resDelete.rowCount} duplicate schedules, offset: ${offset}`);
        }
    } catch (error) {
        console.log('error', error);
    } finally {
        if (client) {
            client.release();
        }
        process.exit();
    }
}
//#endregion


main();