const pg = require('pg')
const { databasePool } = require('../config/database')
const moment = require('moment')

module.exports = {
    /**
     * 
     * @returns {Promise<pg.QueryResultRow>}
     */
    lineGroupRows: async (currentYear, currentMonth, onlySql = false) => {
        const lineGroupQuery =
            `
                select 
                    tml.line_id,
                    tmg.group_id,
                    tmsm.month_num
                from 
                    (select * from tb_m_lines order by line_id asc) tml,
                    (select * from tb_m_groups where is_active = true) tmg,
                    (select date_part('month', date) as month_num from tb_m_schedules where date_part('month', date) = '${currentMonth}' and date_part('year', date) = ${currentYear} group by month_num) tmsm
            `
        if (onlySql)
        {
            return lineGroupQuery
        }

        const lgQuery = await databasePool.query(lineGroupQuery)
        return lgQuery.rows
    }
}   