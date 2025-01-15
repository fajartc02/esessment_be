const pg = require('pg')
const moment = require('moment')

module.exports = {
    /**
     * 
     * @returns {Promise<pg.QueryResultRow> | string}
     */
    lineGroupRows: async (db, currentYear, currentMonth, onlySql = false) => {
        const lineGroupQuery =
            `
                select 
                    tml.line_id,
                    tmg.group_id,
                    tmsm.month_num,
                    tml.line_nm
                from 
                    (select * from tb_m_lines where deleted_dt is null order by line_id asc) tml,
                    (select * from tb_m_groups where is_active = true and deleted_dt is null) tmg,
                    (select date_part('month', date) as month_num from tb_m_schedules where date_part('month', date) = '${currentMonth}' and date_part('year', date) = ${currentYear} group by month_num) tmsm
            `
        if (onlySql)
        {
            return lineGroupQuery
        }

        const lgQuery = await db.query(lineGroupQuery)
        return lgQuery.rows
    }
}   