const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })


const { databasePool } = require('../../config/database');
const table = require('../../config/table')
const moment = require('moment')
const { queryTransaction } = require('../../helpers/query')
const { getRandomInt } = require('../../helpers/formatting')
const logger = require('../../helpers/logger')


// run cmd : SET NODE_ENV=local && node ./design/seeders/4sManualUpdatePlan.seeder.js

console.log('env', {
    env: process.env.NODE_ENV,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false
})

console.log(`Seeder Running ...`)

const main = async () => {
    try
    {
        const monthNum = 5
        const yearNum = 2024

        const parentSubScheduleSql = `select *
            from
                (
                    select distinct on (tbrcs.freq_id, tbrcs.zone_id, tbrcs.kanban_id)
                        tbrcs.main_schedule_id,
                        tmf.freq_id,
                        tmz.zone_id,
                        tmk.kanban_id
                    from
                        tb_r_4s_sub_schedules tbrcs
                            join tb_m_schedules tmsc on tbrcs.schedule_id = tmsc.schedule_id
                            join tb_m_kanbans tmk on tbrcs.kanban_id = tmk.kanban_id
                            join tb_m_zones tmz on tbrcs.zone_id = tmz.zone_id
                            join tb_m_freqs tmf on tbrcs.freq_id = tmf.freq_id
                            join tb_r_4s_main_schedules trmsc on
                                tbrcs.main_schedule_id = trmsc.main_schedule_id
                                and trmsc.month_num = date_part('month', tmsc.date)
                                and trmsc.year_num = date_part('year', tmsc.date)
                            left join tb_m_users tmu on tmu.user_id = tbrcs.pic_id
                            left join tb_m_users tmu_actual on tmu_actual.user_id = tbrcs.actual_pic_id
                            join lateral (
                                            select * from tb_m_lines where line_id = trmsc.line_id
                                            ) tml on true
                            join tb_m_groups tmg on trmsc.group_id = tmg.group_id
                            left join (
                                        select
                                            kanban_id,
                                            sum(standart_time)::real as standart_time
                                        from
                                            tb_m_4s_item_check_kanbans
                                        group by kanban_id
                                    ) tmich_c on tmk.kanban_id = tmich_c.kanban_id

                    where
                        tbrcs.main_schedule_id in (
                                                    select 
                                                        main_schedule_id 
                                                    from 
                                                        tb_r_4s_main_schedules
                                                    where 
                                                        month_num = ${monthNum} 
                                                        and year_num = ${yearNum}
                                                    )
                ) a`

        const { rows } = await databasePool.query(parentSubScheduleSql)

        if (rows && rows.length > 0)
        {
            const parentSub = rows
            let emptyPlanSub = []
            for (let parentSubIndex = 0; parentSubIndex < parentSub.length; parentSubIndex++)
            {
                const childSubSql = `select 
                                        * 
                                    from 
                                        tb_r_4s_sub_schedules 
                                    where 
                                        main_schedule_id = '${parentSub[parentSubIndex].main_schedule_id}'
                                        and freq_id = '${parentSub[parentSubIndex].freq_id}'
                                        and zone_id = '${parentSub[parentSubIndex].zone_id}'
                                        and kanban_id = '${parentSub[parentSubIndex].kanban_id}'
                                        and plan_time is not null`

                const childSubQuery = await databasePool.query(childSubSql)
                //console.log('childSubQuery', childSubQuery.rowCount);
                
                if (childSubQuery.rows && childSubQuery.rows.length == 0)
                {
                    emptyPlanSub.push({
                        main_schedule_id: parentSub[parentSubIndex].main_schedule_id,
                        freq_id: parentSub[parentSubIndex].freq_id,
                        zone_id: parentSub[parentSubIndex].zone_id,
                        kanban_id: parentSub[parentSubIndex].kanban_id
                    })
                }
            }

            if (emptyPlanSub.length > 0)
            {
                let monthlyPlans = []
                for (let i = 0; i < emptyPlanSub.length; i++)
                {
                    const sql = `select 
                                    tr4sss.sub_schedule_id,
                                    tmf.precition_val, 
                                    tmf.freq_nm,
                                    tms.date
                                from
                                    tb_r_4s_sub_schedules tr4sss
                                    join tb_m_freqs tmf on tr4sss.freq_id = tmf.freq_id
                                    join tb_m_schedules tms on tr4sss.schedule_id = tms.schedule_id
                                where
                                    main_schedule_id = ${emptyPlanSub[i].main_schedule_id}
                                    and kanban_id = ${emptyPlanSub[i].kanban_id}
                                    and tmf.freq_id = ${emptyPlanSub[i].freq_id}
                                    and zone_id = ${emptyPlanSub[i].zone_id}
                                    and shift_type = 'morning_shift'`

                    //console.log('sql', sql);
                    const query = await databasePool.query(sql)
                    console.log('query', query.rowCount);

                    if (query && query.rows && query.rows.length > 0)
                    {
                        if (query.rows[0].precition_val >= 30)
                        {
                            const randomElement = query.rows[getRandomInt(0, query.rows.length - 1)]
                            monthlyPlans.push(`update 
                                                    tb_r_4s_sub_schedules 
                                                set 
                                                    plan_time = '${randomElement.date}' 
                                                where 
                                                    sub_schedule_id = ${randomElement.sub_schedule_id}`)
                        }
                    }
                }

                console.log('monthlyPlans', monthlyPlans);
                /* await queryTransaction(async (db) => {
                    await db.query(monthlyPlans.join(';'))
                }) */

                //console.log('monthlyPlans', monthlyPlans.join(';\n'));
            }
        }
    }
    catch (error)
    {
        console.log('error', error);
    }
}

main()
    .then(() => process.exit())
    .catch((e) => {
        console.log('error', e);
        process.exit()
    })