const table = require("../config/table");
const {
    poolQuery
} = require("../helpers/query")

const fromSubScheduleSql = `
    ${table.tb_r_4s_sub_schedules} tbrcs
    join ${table.tb_m_schedules} tmsc on tbrcs.schedule_id = tmsc.schedule_id
    join ${table.tb_m_kanbans} tmk on tbrcs.kanban_id = tmk.kanban_id
    join ${table.tb_m_zones} tmz on tbrcs.zone_id = tmz.zone_id
    join ${table.tb_m_freqs} tmf on tbrcs.freq_id = tmf.freq_id
    join ${table.tb_r_4s_main_schedules} trmsc on 
      tbrcs.main_schedule_id = trmsc.main_schedule_id 
      and trmsc.month_num = date_part('month', tmsc.date)
      and trmsc.year_num = date_part('year', tmsc.date)
    left join ${table.tb_m_users} tmu on tmu.user_id = tbrcs.pic_id
    left join ${table.tb_m_users} tmu_actual on tmu_actual.user_id = tbrcs.actual_pic_id
    join lateral (
      select * from ${table.tb_m_lines} where line_id = trmsc.line_id
    ) tml on true
    join ${table.tb_m_groups} tmg on trmsc.group_id = tmg.group_id
    left join (
      select 
        kanban_id, 
        sum(standart_time)::real as standart_time
      from ${table.tb_m_4s_item_check_kanbans} 
      group by kanban_id
    ) tmich_c on tmk.kanban_id = tmich_c.kanban_id
`

const selectSubScheduleCol = [
    'tml.uuid as line_id',
    'tmg.uuid as group_id',
    'tbrcs.main_schedule_id',
    'trmsc.uuid as main_schedule_uuid',
    'tbrcs.uuid as sub_schedule_id',
    'tmk.uuid as kanban_id',
    'tmz.uuid as zone_id',
    'tmf.uuid as freq_id',
    'tmf.freq_id as freq_real_id',
    'tmz.zone_id as zone_real_id',
    'tmu.uuid as pic_id',
    'tmu_actual.uuid as actual_pic_id',
    'tmk.kanban_id as kanban_real_id',
    'tmu.user_id as pic_real_id',
    'tml.line_nm',
    'tmg.group_nm',
    'tmz.zone_nm',
    'tmk.kanban_no',
    'tmk.area_nm',
    'tmich_c.standart_time::REAL as standart_time',
    'tmu.fullname as pic_nm',
    'tmu_actual.fullname as actual_pic_nm',
    'tbrcs.plan_time',
    'tbrcs.actual_time',
    'tmf.freq_nm',
    'tmf.precition_val',
    'tmf.color',
    'trmsc.year_num',
    'trmsc.month_num',
]

const selectSubScheduleSql = selectSubScheduleCol.join(', ')

/**
 * CORRECTED: Fetch all children for given parent combinations
 * pic_real_id is NOT used to filter children - only to identify parent rows
 */
const getAllChildrenSubSchedulesOptimized2 = async (
    mainScheduleRealId,
    scheduleFilters // array of {freq_real_id, zone_real_id, kanban_real_id}
) => {
    if (!scheduleFilters || scheduleFilters.length === 0) {
        return [];
    }

    // Build filter for freq_id, zone_id, kanban_id ONLY (not pic_id)
    const filterValues = scheduleFilters.map((filter) => 
        `(${filter.freq_real_id}, ${filter.zone_real_id}, ${filter.kanban_real_id})`
    ).join(',');

    const childrenSql = `
        WITH filter_set AS (
            SELECT DISTINCT * FROM (VALUES ${filterValues}) 
            AS t(freq_id, zone_id, kanban_id)
        ),
        -- Pre-aggregate sign checkers to avoid multiple lateral joins
        sign_checkers_agg AS (
            SELECT 
                main_schedule_id,
                end_date,
                MAX((CASE WHEN is_tl_1 THEN uuid END)::text) as tl1_sign_checker_id,
                MAX(CASE WHEN is_tl_1 THEN sign END) as tl1_sign,
                MAX((CASE WHEN is_gl THEN uuid END)::text) as gl_sign_checker_id,
                MAX(CASE WHEN is_gl THEN sign END) as gl_sign,
                MAX((CASE WHEN is_sh THEN uuid END)::text) as sh_sign_checker_id,
                MAX(CASE WHEN is_sh THEN sign END) as sh_sign
            FROM ${table.tb_r_4s_schedule_sign_checkers}
            WHERE main_schedule_id = ${mainScheduleRealId}
                AND (is_tl_1 = true OR is_gl = true OR is_sh = true)
            GROUP BY main_schedule_id, end_date
        ),
        -- Pre-aggregate item checks
        item_checks_agg AS (
            SELECT 
                rsick.sub_schedule_id,
                COUNT(*) as total_checked
            FROM ${table.tb_r_4s_schedule_item_check_kanbans} rsick
            WHERE EXISTS (
                SELECT 1 FROM ${table.tb_r_4s_sub_schedules} tbrcs2
                WHERE tbrcs2.sub_schedule_id = rsick.sub_schedule_id
                    AND tbrcs2.main_schedule_id = ${mainScheduleRealId}
            )
            GROUP BY rsick.sub_schedule_id
        ),
        -- Pre-aggregate comments
        comments_agg AS (
            SELECT 
                sub_schedule_id,
                COUNT(*)::integer as total_comment
            FROM ${table.tb_r_4s_comments}
            WHERE EXISTS (
                SELECT 1 FROM ${table.tb_r_4s_sub_schedules} tbrcs2
                WHERE tbrcs2.sub_schedule_id = ${table.tb_r_4s_comments}.sub_schedule_id
                    AND tbrcs2.main_schedule_id = ${mainScheduleRealId}
            )
            GROUP BY sub_schedule_id
        ),
        -- Latest findings per sub_schedule
        latest_findings AS (
            SELECT DISTINCT ON (sub_schedule_id)
                sub_schedule_id,
                finding_id
            FROM ${table.v_4s_finding_list}
            WHERE deleted_dt IS NULL
                AND EXISTS (
                    SELECT 1 FROM ${table.tb_r_4s_sub_schedules} tbrcs2
                    WHERE tbrcs2.uuid = ${table.v_4s_finding_list}.sub_schedule_id
                        AND tbrcs2.main_schedule_id = ${mainScheduleRealId}
                )
            ORDER BY sub_schedule_id, finding_date DESC
        )
        SELECT 
            tbrcs.uuid as sub_schedule_id,
            tbrcs.freq_id as freq_real_id,
            tbrcs.zone_id as zone_real_id,
            tbrcs.kanban_id as kanban_real_id,
            sca.tl1_sign_checker_id,
            sca.gl_sign_checker_id,
            sca.sh_sign_checker_id,
            tmsc.date,
            EXTRACT(DAY FROM tmsc.date)::INTEGER as date_num,
            COALESCE(tmsc.is_holiday, tbrcs.is_holiday, false) as is_holiday,
            true::boolean as can_sign,
            CASE
                WHEN ica.total_checked > 0 AND lf.finding_id IS NOT NULL THEN 'PROBLEM'
                WHEN ica.total_checked > 0 AND tbrcs.plan_time IS NOT NULL THEN 'ACTUAL'
                WHEN tbrcs.shift_type = 'night_shift' AND tbrcs.plan_time IS NULL THEN 'NIGHT_SHIFT'
                WHEN tbrcs.plan_time IS NOT NULL THEN 'PLANNING'
                ELSE NULL
            END as status,
            COALESCE(sca.tl1_sign IS NOT NULL AND sca.tl1_sign != '', false) as has_tl1_sign,
            COALESCE(sca.gl_sign IS NOT NULL AND sca.gl_sign != '', false) as has_gl_sign,
            COALESCE(sca.sh_sign IS NOT NULL AND sca.sh_sign != '', false) as has_sh_sign,
            COALESCE(ca.total_comment, 0) as total_comment
        FROM ${table.tb_r_4s_sub_schedules} tbrcs
        INNER JOIN ${table.tb_m_schedules} tmsc 
            ON tbrcs.schedule_id = tmsc.schedule_id
        INNER JOIN filter_set fs 
            ON tbrcs.freq_id = fs.freq_id 
            AND tbrcs.zone_id = fs.zone_id 
            AND tbrcs.kanban_id = fs.kanban_id
        LEFT JOIN sign_checkers_agg sca 
            ON sca.main_schedule_id = tbrcs.main_schedule_id 
            AND sca.end_date = tmsc.date
        LEFT JOIN item_checks_agg ica 
            ON ica.sub_schedule_id = tbrcs.sub_schedule_id
        LEFT JOIN comments_agg ca 
            ON ca.sub_schedule_id = tbrcs.sub_schedule_id
        LEFT JOIN latest_findings lf 
            ON lf.sub_schedule_id = tbrcs.uuid
        WHERE tbrcs.deleted_dt IS NULL
            AND tbrcs.main_schedule_id = ${mainScheduleRealId}
        ORDER BY tbrcs.freq_id, tbrcs.zone_id, tbrcs.kanban_id, date_num
    `;
console.log("childrensql", childrenSql);
    const startTime = Date.now();
    const result = await poolQuery(childrenSql);
    const timeTaken = Date.now() - startTime;
    console.log(`✓ Optimized getAllChildrenSubSchedules: ${timeTaken}ms for ${result.rows.length} rows`);

    return result.rows;
};

/**
 * Group children by parent composite key (freq + zone + kanban ONLY)
 */
const groupChildrenByParent2 = (children) => {
    const grouped = {};
    
    children.forEach(child => {
        // Key is based on freq, zone, kanban ONLY - not pic_id
        const key = `${child.freq_real_id}_${child.zone_real_id}_${child.kanban_real_id}`;
        
        if (!grouped[key]) {
            grouped[key] = [];
        }
        
        // Keep only the fields needed by frontend
        const cleanChild = {
            sub_schedule_id: child.sub_schedule_id,
            tl1_sign_checker_id: child.tl1_sign_checker_id,
            gl_sign_checker_id: child.gl_sign_checker_id,
            sh_sign_checker_id: child.sh_sign_checker_id,
            date: child.date,
            date_num: child.date_num,
            is_holiday: child.is_holiday,
            can_sign: child.can_sign,
            status: child.status,
            has_tl1_sign: child.has_tl1_sign,
            has_gl_sign: child.has_gl_sign,
            has_sh_sign: child.has_sh_sign,
            total_comment: child.total_comment
        };
        
        grouped[key].push(cleanChild);
    });
    
    return grouped;
};

/**
 * MAIN FUNCTION - Attaches children to parent schedules
 * Children are matched by freq_id + zone_id + kanban_id (NOT pic_id)
 */
const attachChildrenToSchedules2 = async (scheduleFinalResult, mainScheduleRealId) => {
    if (!scheduleFinalResult || scheduleFinalResult.length === 0) {
        return [];
    }

    const startTime = Date.now();

    // Step 1: Extract UNIQUE combinations of freq, zone, kanban (not pic)
    const uniqueFilters = new Map();
    scheduleFinalResult.forEach(item => {
        const key = `${item.freq_real_id}_${item.zone_real_id}_${item.kanban_real_id}`;
        if (!uniqueFilters.has(key)) {
            uniqueFilters.set(key, {
                freq_real_id: item.freq_real_id,
                zone_real_id: item.zone_real_id,
                kanban_real_id: item.kanban_real_id
            });
        }
    });

    const scheduleFilters = Array.from(uniqueFilters.values());
    const allChildren = await getAllChildrenSubSchedulesOptimized2(
        mainScheduleRealId, 
        scheduleFilters
    );

    // Step 3: Group children by their parent key (freq + zone + kanban)
    const groupedChildren = groupChildrenByParent2(allChildren);

    // Step 4: Synchronously attach children to parents
    const scheduleRows = scheduleFinalResult.map(item => {
        // Match using freq + zone + kanban ONLY
        const key = `${item.freq_real_id}_${item.zone_real_id}_${item.kanban_real_id}`;
        
        return {
            no: item.no,
            line_id: item.line_id,
            group_id: item.group_id,
            main_schedule_id: item.main_schedule_uuid,
            sub_schedule_id: item.sub_schedule_id,
            kanban_id: item.kanban_id,
            zone_id: item.zone_id,
            freq_id: item.freq_id,
            pic_id: item.pic_id,
            actual_pic_id: item.actual_pic_id,
            line_nm: item.line_nm,
            group_nm: item.group_nm,
            zone_nm: item.zone_nm,
            kanban_no: item.kanban_no,
            area_nm: item.area_nm,
            standart_time: item.standart_time,
            pic_nm: item.pic_nm,
            actual_pic_nm: item.actual_pic_nm,
            plan_time: item.plan_time,
            actual_time: item.actual_time,
            freq_nm: item.freq_nm,
            precition_val: item.precition_val,
            color: item.color,
            row_span_pic: 1,
            row_span_freq: 1,
            row_span_zone: 1,
            // All children for this freq+zone+kanban combination
            children: groupedChildren[key] || []
        };
    });

    const timeTaken = Date.now() - startTime;
    console.log(`✓ Total attachChildrenToSchedules: ${timeTaken}ms for ${scheduleRows.length} parent rows with ${allChildren.length} total children`);

    return scheduleRows;
};

const subScheduleRows = async (params) => {
    const { main_schedule_id, freq_id, zone_id, kanban_id, line_id, group_id, month_year_num } = params
    let { limit, current_page } = params;

    let filterCondition = []

    if (freq_id && freq_id != null && freq_id != "") {
        filterCondition.push(` freq_id = '${freq_id}' `)
    }
    if (zone_id && zone_id != null && zone_id != "") {
        filterCondition.push(` zone_id = '${zone_id}' `)
    }
    if (kanban_id && kanban_id != null && kanban_id != "") {
        filterCondition.push(` kanban_id = '${kanban_id}' `)
    }
    if (line_id && line_id != null && line_id != "") {
        filterCondition.push(` line_id = '${line_id}' `)
    }
    if (month_year_num && month_year_num != null && month_year_num != "") {
        let MYFilterSplit = month_year_num.split('-')

        if (MYFilterSplit.length == 1) {
            if (MYFilterSplit[0].length == 4) {
                filterCondition.push(` year_num = '${MYFilterSplit[0]}}' `)
            } else {
                filterCondition.push(` month_num = '${parseInt(MYFilterSplit[0])}}' `)
            }
        } else {
            filterCondition.push(` year_num || '-' || month_num = '${MYFilterSplit[0]}-${parseInt(MYFilterSplit[1])}' `)
        }
    }
    if (group_id && group_id != null && group_id != "") {
        filterCondition.push(` group_id = '${group_id}' `)
    }

    let paginated = false
    const whereMainSchedule = `(select main_schedule_id from ${table.tb_r_4s_main_schedules} where uuid = '${main_schedule_id}')`
    const originScheduleSql = `
          select * from (
                select distinct on (tbrcs.freq_id, tbrcs.zone_id, tbrcs.kanban_id)
                  ${selectSubScheduleSql}  
              from
                 ${fromSubScheduleSql}
              where
                tbrcs.main_schedule_id = ${whereMainSchedule}
              order by
                tbrcs.freq_id, tbrcs.zone_id, tbrcs.kanban_id, tbrcs.pic_id nulls last
          ) a 
          where
            1 = 1
            ${filterCondition.length > 0 ? `and ${filterCondition.join('and')}` : ''}`
    let scheduleSql = `${originScheduleSql}`

    if (limit && current_page) {
        current_page = parseInt(current_page ?? 1)
        limit = parseInt(limit ?? 10)

        const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
        const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

        paginated = true
        scheduleSql = `
            select row_number () over (
                            order by
                            precition_val
                        )::integer as no, * from ( ${originScheduleSql} ) a order by precition_val ${qLimit} ${qOffset}
        `
    }

    console.log('scheduleSql', scheduleSql)


    const scheduleFinalResult = (await poolQuery(scheduleSql)).rows;

    // Extract the real main_schedule_id
    const mainScheduleRealId = scheduleFinalResult.length > 0
        ? scheduleFinalResult[0].main_schedule_id
        : null;

    if (!mainScheduleRealId) {
        return paginated ? {
            current_page: params.current_page,
            total_page: 0,
            total_data: 0,
            limit: params.limit,
            list: []
        } : [];
    }

    // OPTIMIZED: Single query to fetch all children
    const scheduleRowsWithChildren = await attachChildrenToSchedules2(
        scheduleFinalResult,
        mainScheduleRealId
    );

    if (paginated) {
        const count = await poolQuery(
            `SELECT count(*)::integer as count FROM ( ${originScheduleSql} ) a`
        );

        return {
            current_page: parseInt(params.current_page),
            total_page: count.rows[0].count > 0
                ? Math.ceil(count.rows[0].count / parseInt(params.limit))
                : 0,
            total_data: count.rows[0].count,
            limit: parseInt(params.limit),
            schedule: scheduleRowsWithChildren
        };
    }

    return scheduleRowsWithChildren;
};

/* subScheduleRows({
  "main_schedule_id": "90c523ad-dbc8-44aa-8839-aca42cd81432",
  "line_id": "882eaf19-d355-4f62-918d-00cec01cd639",
  "month_year_num": "2026-02",
  "limit": "40",
  "current_page": "1"
}) */
/* subScheduleRows({
  "main_schedule_id": "bb8d813b-ac13-45b5-8c84-e06f231ac0e1",
  "line_id": "882eaf19-d355-4f62-918d-00cec01cd639",
  "month_year_num": "2026-02",
  "limit": "40",
  "current_page": "1"
}) */
module.exports = {
    subScheduleRows
}

