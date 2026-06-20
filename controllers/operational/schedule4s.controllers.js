const table = require("../../config/table")
const {
    queryCustom,
    queryGET,
    queryPUT,
    queryTransaction,
    queryPutTransaction,
    queryPostTransaction,
    queryPOST
} = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const { arrayOrderBy, objToString } = require("../../helpers/formatting")
const moment = require('moment')
const logger = require('../../helpers/logger')
const { cacheGet, cacheAdd, cacheDelete } = require('../../helpers/cacheHelper')
const { database } = require('../../config/database')

const { shiftByGroupId } = require('../../services/shift.services')
const { genSingleMonthlySubScheduleSchema, genSingleSignCheckerSqlFromSchema } = require('../../services/4s.services')
const { bulkToSchema } = require('../../helpers/schema')
const { databasePool } = require('../../config/database');
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const query = require("../../helpers/query")
const subScheduleService = require("../../services/schedule4s.services")
const uuidToId = require("../../helpers/uuidToId");

const fromSubScheduleSql = `
    ${table.tb_r_4s_sub_schedules} tbrcs
    join ${table.tb_m_schedules} tmsc on tbrcs.schedule_id = tmsc.schedule_id
    join ${table.tb_m_kanbans} tmk on tbrcs.kanban_id = tmk.kanban_id
    join ${table.tb_m_zones} tmz on tbrcs.zone_id = tmz.zone_id
    join ${table.tb_m_freqs} tmf on tbrcs.freq_id = tmf.freq_id
    join ${table.tb_r_4s_main_schedules} trmsc on 
      tbrcs.main_schedule_id = trmsc.main_schedule_id
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
 * @typedef {Object} ChildrenSubSchedule
 *
 * @param {number} mainScheduleRealId
 * @param {number} freqRealId
 * @param {number} zoneRealId
 * @param {number} kanbanRealId
 * @param {?number} picRealId
 * @returns {Promise<Array<ChildrenSubSchedule>>}
 */
const childrenSubSchedule = async (
    client,
    mainScheduleRealId,
    freqRealId,
    zoneRealId,
    kanbanRealId,
    planPicRealId
) => {
    let byPic = ``
    if (planPicRealId) {
        byPic = ` and tbrcs.pic_id = '${planPicRealId}' `
    }


    let childrenSql = `
              select * from (
                 select
                    tbrcs.uuid as sub_schedule_id,
                    trcc1.tl1_sign_checker_id,
                    trcc2.gl_sign_checker_id,
                    trcc3.sh_sign_checker_id,
                    tmsc.date,
                    EXTRACT(WEEK FROM tmsc.date) as week_num,
                    EXTRACT('Day' FROM tmsc.date)::INTEGER as date_num,
                    tmsc.is_holiday or tbrcs.is_holiday as is_holiday, -- null of shift_type was set as holiday from monthly scheduler 
                    case
                      when item_check.total_ng_checked > 0 then
                        'PROBLEM'
                      when item_check.total_checked > 0 and tbrcs.plan_time is not null then
                        'ACTUAL'
                      when tbrcs.shift_type = 'night_shift' and tbrcs.plan_time is null then
                        'NIGHT_SHIFT'
                      when tbrcs.plan_time is not null then
                        'PLANNING'
                    end as status,
                    case
                      when trcc1.sign is not null and trcc1.sign != '' then
                        true::boolean
                      else 
                        false::boolean
                    end as has_tl1_sign,
                    case
                      when trcc2.sign is not null and trcc2.sign != '' then
                        true::boolean
                      else
                        false::boolean
                    end as has_gl_sign,
                    case
                        when trcc3.sign is not null and trcc3.sign != '' then
                            true::boolean
                        else
                            false::boolean
                        end as has_sh_sign,
                    comment.total_comment        
                  from
                      ${fromSubScheduleSql}
                      left join lateral (
                                        select
                                          uuid as tl1_sign_checker_id,
                                          sign
                                        from
                                          ${table.tb_r_4s_schedule_sign_checkers}
                                        where
                                          main_schedule_id = tbrcs.main_schedule_id
                                          and is_tl_1 = true 
                                          and end_date = tmsc."date"
                                        limit 1
                      ) trcc1 on true
                      left join lateral (
                                        select gl_sign_checker_id, sign
                                          from (select row_number() over (order by sign_checker_id) as row_idx,
                                          uuid as gl_sign_checker_id,
                                          sign,
                                          end_date
                                          from tb_r_4s_schedule_sign_checkers
                                          where main_schedule_id = tbrcs.main_schedule_id
                                          and is_gl = true) trcc3
                                          where end_date = tmsc."date"
                                          limit 1
                      ) trcc2 on true
                      left join lateral (
                                          select sh_sign_checker_id, sign
                                          from (select row_number() over (order by sign_checker_id) as row_idx,
                                          uuid as sh_sign_checker_id,
                                          sign,
                                          end_date
                                          from tb_r_4s_schedule_sign_checkers
                                          where main_schedule_id = tbrcs.main_schedule_id
                                          and is_sh = true) trcc3
                                          where end_date = tmsc."date"
                                          limit 1
                      ) trcc3 on true
                      left join lateral (
                        select *
                        from
                            ${table.v_4s_finding_list} v4sfl
                        where
                          v4sfl.sub_schedule_id = tbrcs.uuid
                          and v4sfl.deleted_dt is null
                        order by v4sfl.finding_date desc
                        limit 1
                      ) finding on true
                      left join lateral (
                        select 
                          count(*) as total_checked,
                          count(case when lower(tj.judgment_nm) = 'ng' then 1 end) as total_ng_checked
                        from 
                          ${table.tb_r_4s_schedule_item_check_kanbans} rsick
                          left join ${table.tb_m_judgments} tj on rsick.judgment_id = tj.judgment_id
                        where
                          rsick.item_check_kanban_id in (
                                                    select 
                                                      item_check_kanban_id 
                                                    from 
                                                      ${table.tb_m_4s_item_check_kanbans} 
                                                    where 
                                                      kanban_id = '${kanbanRealId}'
                                                      )
                                                      and rsick.sub_schedule_id = tbrcs.sub_schedule_id
                                                      and rsick.deleted_dt is null
                      ) item_check on true
                      left join lateral (
                         select count(*)::real as total_comment from ${table.tb_r_4s_comments} where sub_schedule_id = tbrcs.sub_schedule_id
                      ) comment on true
                  where
                      tbrcs.deleted_dt is null
                      and tbrcs.main_schedule_id = ${mainScheduleRealId}
                      and tbrcs.freq_id = '${freqRealId}'
                      and tbrcs.zone_id = '${zoneRealId}'
                      and tbrcs.kanban_id = '${kanbanRealId}'
                      
              ) a order by date_num`

    //console.log('childrensql', childrenSql)
    //logger(childrenSql, 'childrenSql')
    //const children = await queryCustom(childrenSql, false)

    const startTime = Date.now();
    const children = await client.query(childrenSql);
    const timeTaken = Date.now() - startTime;
    console.log(`4S childrenSubSchedule query time = ${Math.floor(timeTaken / 1000)} seconds`);

    return children.rows
}

const subScheduleCacheKey = (
    main_schedule_id,
    freq_id = null,
    zone_id = null,
    kanban_id = null,
    line_id = null,
    group_id = null,
    month_year_num = null,
    limit = null,
    current_page = null,
) => {
    const obj = {
        main_schedule_id: main_schedule_id
    }

    if (freq_id) {
        obj.freq_id = freq_id
    }
    if (zone_id) {
        obj.zone_id = zone_id
    }
    if (kanban_id) {
        obj.kanban_id = kanban_id
    }
    if (line_id) {
        obj.line_id = line_id
    }
    if (group_id) {
        obj.group_id = group_id
    }
    if (month_year_num) {
        obj.month_year_num = month_year_num
    }
    if (limit) {
        obj.limit = limit
    }
    if (current_page) {
        obj.current_page = current_page
    }

    return objToString(obj)
}

const subScheduleRows = async (
    client,
    params
) => {
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
                tbrcs.freq_id, tbrcs.zone_id, tbrcs.kanban_id, tbrcs.changed_dt desc nulls last
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
    //logger(scheduleSql, 'scheduleSql')

    const query = (await client.query(scheduleSql)).rows
    if (paginated) {
        const count = await client.query(`select count(*)::integer as count from ( ${originScheduleSql} ) a `)

        const countRows = count.rows[0]
        return {
            current_page: params.current_page,
            total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +params.limit) : 0,
            total_data: countRows.count,
            limit: params.limit,
            list: query,
        }
    }

    return query
}


module.exports = {
    get4sMainSchedule: async (req, res) => {
        try {
            let { line_id, group_id, month_year_num } = req.query;
            let { limit, current_page } = req.query;

            // =========================
            // ✅ WHITELIST PARAM
            // =========================
            const allowedParams = ['line_id', 'group_id', 'month_year_num', 'limit', 'current_page'];

            for (const key in req.query) {
                if (!allowedParams.includes(key)) {
                    return response.failed(res, `Invalid param: ${key}`);
                }
            }

            // =========================
            // ✅ HELPER (FIXED)
            // =========================
            const sanitize = (val) =>
                val ? val.replace(/['";\\]/g, "").trim() : val;

            const isValidUUID = (val) =>
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

            const numberRegex = /^[0-9]+$/;

            // =========================
            // ✅ SANITIZE INPUT
            // =========================
            line_id = sanitize(line_id);
            group_id = sanitize(group_id);
            month_year_num = sanitize(month_year_num);

            // =========================
            // ✅ VALIDASI UUID (STRICT)
            // =========================
            if (line_id && !isValidUUID(line_id)) {
                return response.failed(res, "Invalid line_id");
            }

            if (group_id && !isValidUUID(group_id)) {
                return response.failed(res, "Invalid group_id");
            }

            // =========================
            // ✅ VALIDASI MONTH-YEAR
            // =========================
            let safeMonth = null;
            let safeYear = null;

            if (month_year_num) {
                const split = month_year_num.split('-');

                if (split.length !== 2) {
                    return response.failed(res, "Format harus YYYY-MM");
                }

                if (!numberRegex.test(split[0]) || !numberRegex.test(split[1])) {
                    return response.failed(res, "Invalid month_year_num");
                }

                safeYear = parseInt(split[0]);
                safeMonth = parseInt(split[1]);

                if (safeYear < 2000 || safeYear > 2100) {
                    return response.failed(res, "Invalid year");
                }

                if (safeMonth < 1 || safeMonth > 12) {
                    return response.failed(res, "Invalid month");
                }
            }

            // =========================
            // ✅ PAGINATION
            // =========================
            current_page = parseInt(current_page ?? 1);
            limit = parseInt(limit ?? 10);

            if (isNaN(limit) || limit < 1 || limit > 100) {
                return response.failed(res, "Invalid limit");
            }

            if (isNaN(current_page) || current_page < 1) {
                return response.failed(res, "Invalid current_page");
            }

            // =========================
            // ✅ PRE-CONVERT UUID (ONCE ONLY)
            // =========================
            let convertedLineId = null;
            let convertedGroupId = null;

            if (line_id) {
                convertedLineId = await uuidToId(
                    table.tb_m_lines,
                    "line_id",
                    line_id
                );

                if (!convertedLineId) {
                    return response.failed(res, "Line not found");
                }
            }

            if (group_id) {
                convertedGroupId = await uuidToId(
                    table.tb_m_groups,
                    "group_id",
                    group_id
                );

                if (!convertedGroupId) {
                    return response.failed(res, "Group not found");
                }
            }

            // =========================
            // ✅ FROM QUERY
            // =========================
            const fromSql = `
                ${table.tb_r_4s_main_schedules} trcp
                join ${table.tb_m_lines} tml on trcp.line_id = tml.line_id
                join ${table.tb_m_groups} tmg on trcp.group_id = tmg.group_id
            `;

            let mainScheduleSql = `
                SELECT 
                    row_number () over (order by trcp.created_dt)::integer as no,
                    trcp.uuid as main_schedule_id,
                    tml.uuid as line_id,
                    tmg.uuid as group_id,
                    trcp.year_num,
                    trcp.month_num,
                    trcp.section_head_sign,
                    trcp.group_leader_sign,
                    trcp.team_leader_sign,
                    tml.line_nm,
                    tmg.group_nm
                FROM ${fromSql}
                WHERE trcp.deleted_dt IS NULL
            `;

            // =========================
            // ✅ FILTER AMAN
            // =========================
            if (convertedLineId) {
                mainScheduleSql += ` AND trcp.line_id = ${convertedLineId}`;
            }

            if (convertedGroupId) {
                mainScheduleSql += ` AND trcp.group_id = ${convertedGroupId}`;
            }

            if (safeMonth && safeYear) {
                mainScheduleSql += ` 
                    AND trcp.year_num = ${safeYear}
                    AND trcp.month_num = ${safeMonth}
                `;
            }

            const qOffset =
                current_page > 1
                    ? `OFFSET ${limit * (current_page - 1)}`
                    : ``;

            const qLimit = `LIMIT ${limit}`;

            mainScheduleSql += ` ORDER BY trcp.created_dt ${qLimit} ${qOffset}`;

            console.log("SAFE QUERY:", mainScheduleSql);

            // =========================
            // ✅ EXECUTE
            // =========================
            const mainScheduleQuery = await queryCustom(mainScheduleSql);
            let result = mainScheduleQuery.rows;

            // =========================
            // ✅ COUNT
            // =========================
            if (result.length > 0) {
                let countSql = `
                    SELECT count(trcp.main_schedule_id)::integer as count
                    FROM ${fromSql}
                    WHERE trcp.deleted_dt IS NULL
                `;

                if (convertedLineId) countSql += ` AND trcp.line_id = ${convertedLineId}`;
                if (convertedGroupId) countSql += ` AND trcp.group_id = ${convertedGroupId}`;

                if (safeMonth && safeYear) {
                    countSql += ` 
                        AND trcp.year_num = ${safeYear}
                        AND trcp.month_num = ${safeMonth}
                    `;
                }

                const count = await queryCustom(countSql);
                const countRows = count.rows[0];

                result = {
                    current_page,
                    total_page: Math.ceil(countRows.count / limit),
                    total_data: countRows.count,
                    limit,
                    list: result,
                };
            }

            response.success(res, "Success to get 4s main schedule", result);

        } catch (error) {
            console.log(error);
            response.failed(res, "Error to get 4s main schedule");
        }
    },
    getNew4sSubSchedule: async (req, res) => {
        try {
            const result = await subScheduleService.subScheduleRows(req.query);
            response.success(res, "Success to get 4s sub schedule", result)
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to get 4s sub schedule")
        }
    },
    get4sSubSchedule: async (req, res) => {
        let client = null;
        try {
            const {
                main_schedule_id,
                freq_id,
                zone_id,
                kanban_id,
                line_id,
                group_id,
                month_year_num,
                limit,
                current_page
            } = req.query;

            // ==========================================
            // ✅ 1. VALIDASI RESOURCE LIMIT (ANTI-LAKE)
            // ==========================================
            const numericRegex = /^[0-9]+$/;

            // Pastikan limit adalah angka murni
            if (limit && !numericRegex.test(limit)) {
                return response.failed(res, "Invalid limit format");
            }

            let safeLimit;

            if (limit === undefined || limit === null || limit === "") {
                safeLimit = 10; // Default jika tidak ada input
            } else if (!numericRegex.test(limit)) {
                return response.failed(res, "Invalid limit format"); // Reject jika ada karakter aneh (; COPY dll)
            } else {
                safeLimit = parseInt(limit);
            }
            const safePage = parseInt(current_page) || 1;

            // LOCK LIMIT: Jangan biarkan user meminta lebih dari 100 data
            // Ini mencegah penyerang menguras RAM server dengan limit=25000
            if (safeLimit > 100) {
                return response.failed(res, "Request too large. Maximum limit is 100.");
            }

            if (safeLimit < 1) {
                return response.failed(res, "Invalid limit");
            }

            // ==========================================
            // ✅ 2. CACHING & VALIDASI DASAR
            // ==========================================
            const cacheKey = subScheduleCacheKey(main_schedule_id, freq_id, zone_id, kanban_id, line_id, group_id, month_year_num, safeLimit, safePage);

            // Aktifkan cache kembali untuk menghemat resource database (Rate Limiting Support)
            const cachedSchedule = cacheGet(cacheKey);
            if (cachedSchedule) {
                return response.success(res, "Success to get 4s sub schedule (cached)", cachedSchedule);
            }

            if (!main_schedule_id || main_schedule_id === "0" || main_schedule_id === "") {
                return response.failed(res, "Error: main_schedule_id is required");
            }

            // ==========================================
            // ✅ 3. EXECUTION WITH POOL CLIENT
            // ==========================================
            let result = {
                schedule: [],
                sign_checker_gl: [],
                sign_checker_sh: []
            };

            client = await databasePool.connect();

            // Kirim safeLimit yang sudah diproteksi ke fungsi query
            let scheduleQuery = await subScheduleRows(client, {
                ...req.query,
                limit: safeLimit,
                current_page: safePage
            });

            if (scheduleQuery) {
                let scheduleFinalResult = Array.isArray(scheduleQuery) ? scheduleQuery : (scheduleQuery.list || []);

                // Proteksi tambahan: Jika hasil query dari database tetap terlalu besar
                if (scheduleFinalResult.length > 200) {
                    scheduleFinalResult = scheduleFinalResult.slice(0, 100);
                }

                const scheduleRows = scheduleFinalResult.map(async (item) => {
                    const mainScheduleRealId = item.main_schedule_id;

                    item.row_span_pic = 1;
                    item.row_span_freq = 1;
                    item.row_span_zone = 1;

                    // Pastikan fungsi childrenSubSchedule juga menggunakan limit jika diperlukan
                    item.children = await childrenSubSchedule(
                        client,
                        mainScheduleRealId,
                        item.freq_real_id,
                        item.zone_real_id,
                        item.kanban_real_id,
                        item.pic_real_id
                    );

                    item.main_schedule_id = item.main_schedule_uuid;

                    // Cleanup data sensitif/tidak perlu
                    const {
                        freq_real_id, zone_real_id, kanban_real_id, pic_real_id,
                        main_schedule_uuid, year_num, month_num, ...cleanItem
                    } = item;

                    return cleanItem;
                });

                result.schedule = await Promise.all(scheduleRows);
                result.limit = safeLimit;
                result.current_page = safePage;
                result.total_data = scheduleQuery?.total_data ? parseInt(scheduleQuery.total_data) : 0;

                // Simpan ke cache agar jika dipanggil berulang (Rate Limit Bypass), server tidak terbebani
                // cacheAdd(cacheKey, result);
            }

            response.success(res, "Success to get 4s sub schedule", result);

        } catch (error) {
            console.error(error);
            response.failed(res, "Error to get 4s sub schedule");
        } finally {
            if (client) client.release();
        }
    },
    get4sSubScheduleTodayPlan: async (req, res) => {
        try {
            let { date, line_id, group_id } = req.query;

            // =========================
            // ✅ HELPER VALIDASI
            // =========================
            const uuidRegex = /^[0-9a-fA-F-]{36}$/;
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            const forbidden = /('|--|;|\|\||\bOR\b|\bAND\b|=)/i;

            const validate = (val, type) => {
                if (!val) return val;

                val = String(val).trim();

                // blok SQL injection pattern
                if (forbidden.test(val)) {
                    throw new Error(`Invalid ${type} (SQL Injection detected)`);
                }

                // validasi tipe
                if (type === "uuid" && !uuidRegex.test(val)) {
                    throw new Error(`Invalid ${type}`);
                }

                if (type === "date" && !dateRegex.test(val)) {
                    throw new Error(`Invalid ${type}`);
                }

                // optional limit panjang
                if (val.length > 50) {
                    throw new Error(`${type} too long`);
                }

                return val;
            };

            // =========================
            // ✅ VALIDASI INPUT
            // =========================
            try {
                line_id = validate(line_id, "uuid");
                group_id = validate(group_id, "uuid");
                date = validate(date, "date");
            } catch (err) {
                return response.failed(res, err.message);
            }

            // =========================
            // ✅ BUILD QUERY AMAN
            // =========================
            let filterCondition = [];

            let scheduleSql = `
                SELECT * FROM (
                    SELECT
                        ${selectSubScheduleSql},
                        date(tbrcs.plan_time) as plan_check_dt,
                        date(tbrcs.actual_time) as actual_check_dt,
                        EXTRACT('day' from tbrcs.plan_time)::real as idxDate
                    FROM ${fromSubScheduleSql}
                    WHERE tbrcs.deleted_dt IS NULL AND trmsc.deleted_dt IS NULL
                    ORDER BY tml.line_nm
                ) a
            `;

            if (line_id) {
                filterCondition.push(`line_id = '${line_id}'`);
            }

            // ⚠️ FIX BUG kamu tadi (ini salah sebelumnya)
            if (group_id) {
                filterCondition.push(`group_id = '${group_id}'`);
            }

            if (date) {
                filterCondition.push(`plan_check_dt = '${date}'`);
            }

            if (filterCondition.length > 0) {
                scheduleSql += ` WHERE ${filterCondition.join(" AND ")}`;
            }

            // =========================
            // ✅ EXECUTE
            // =========================
            const result = (await queryCustom(scheduleSql, false)).rows;

            result.map((item) => {
                item.main_schedule_id = item.main_schedule_uuid;

                delete item.freq_real_id;
                delete item.zone_real_id;
                delete item.kanban_real_id;
                delete item.pic_real_id;
                delete item.main_schedule_uuid;

                return item;
            });

            response.success(
                res,
                "Success to get today activities 4s sub schedule",
                result
            );

        } catch (e) {
            console.log(e);
            response.failed(res, e.message || "Error to get today activities 4s sub schedule");
        }
    },
    get4sSignCheckerBySignCheckerId: async (req, res) => {
        try {
            let signCheckerUuid = req.params.sign_checker_id;

            // =========================
            // ✅ SANITIZE
            // =========================
            signCheckerUuid = signCheckerUuid?.trim();

            // =========================
            // ✅ VALIDATION
            // =========================

            // UUID v4 strict
            const uuidRegex =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            // block karakter berbahaya
            const hasInjection = (val) =>
                /('|--|;|\|\||\bOR\b|\bAND\b)/i.test(val);

            const hasInvalidChar = (val) =>
                /[^0-9a-fA-F-]/.test(val);

            if (
                !signCheckerUuid ||
                !uuidRegex.test(signCheckerUuid) ||
                hasInjection(signCheckerUuid) ||
                hasInvalidChar(signCheckerUuid)
            ) {
                return response.failed(res, "Invalid sign_checker_id");
            }

            // =========================
            // ✅ QUERY
            // =========================

            const signCheckerRows = await queryGET(
                table.tb_r_4s_schedule_sign_checkers,
                `WHERE uuid = '${signCheckerUuid}'`,
                [
                    'uuid as sign_checker_id',
                    'sign',
                    'is_tl_1',
                    'is_tl_2',
                    'is_gl',
                    'is_sh',
                ]
            );

            let result = {};
            if (signCheckerRows?.length > 0) {
                result = signCheckerRows[0];

                if (!result.is_tl_1) delete result.is_tl_1;
                if (!result.is_tl_2) delete result.is_tl_2;
                if (!result.is_gl) delete result.is_gl;
                if (!result.is_sh) delete result.is_sh;
            }

            response.success(res, "Success to get 4s sign checker", result);

        } catch (error) {
            console.log(error);
            response.failed(res, "Error to get 4s sign checker");
        }
    },
    getDetail4sSubSchedule: async (req, res) => {
        try {
            const sub_schedule_uuid = req.params.id

            const subScheduleSql = `select 
                                            ${selectSubScheduleSql},
                                            date(tbrcs.plan_time) as plan_time,
                                            date(tbrcs.actual_time) as actual_time
                                          from
                                            ${fromSubScheduleSql}
                                          where
                                            tbrcs.uuid = '${sub_schedule_uuid}'
                                          limit 1`

            let subScheduleQuery = await queryCustom(subScheduleSql, false)
            if (subScheduleQuery.rows.length == 0) {
                throw "Can't find 4s sub schedule with id provided"
            }

            subScheduleQuery = subScheduleQuery.rows[0]

            if (!subScheduleQuery.plan_time) {
                subScheduleQuery.item_check_kanbans = []
                subScheduleQuery.main_schedule_id = subScheduleQuery.main_schedule_uuid

                delete subScheduleQuery.freq_real_id
                delete subScheduleQuery.zone_real_id
                delete subScheduleQuery.kanban_real_id
                delete subScheduleQuery.pic_real_id
                delete subScheduleQuery.main_schedule_uuid

                response.success(res, "Success to get detail 4s sub schedule", subScheduleQuery)
                return
            }

            const sqlItemCheckKanbans = `select
                                                  tmic.uuid as item_check_kanban_id,
                                                  tmk.uuid as kanban_id,
                                                  tmju.uuid as judgment_id,
                                                  trsic.uuid as schedule_item_check_kanban_id,
                                                  tmk.kanban_no,
                                                  tmic.item_check_nm,
                                                  tmic.method,
                                                  tmic.control_point,
                                                  trsic.actual_time::REAL actual_time,
                                                  trsic.checked_date,
                                                  tmju.judgment_nm,
                                                  tmju.is_abnormal,
                                                  trh4ic.standart_time::real as before_standart_time,
                                                  case 
                                                    when trsic.standart_time is not null then 
                                                        trsic.standart_time::real
                                                    else  tmic.standart_time::real
                                                    end as standart_time    
                                              from
                                                  ${table.tb_m_4s_item_check_kanbans} tmic
                                                  join ${table.tb_m_kanbans} tmk on tmic.kanban_id = tmk.kanban_id 
                                                  left join lateral (
                                                    select 
                                                      * 
                                                    from 
                                                      ${table.tb_r_4s_schedule_item_check_kanbans}
                                                    where 
                                                      item_check_kanban_id = tmic.item_check_kanban_id
                                                      and checked_date::date = '${subScheduleQuery.plan_time}'::date
                                                      and deleted_dt is null
                                                    order by
                                                      schedule_item_check_kanban_id desc
                                                    limit 1
                                                  ) trsic on true
                                                  left join ${table.tb_m_judgments} tmju on trsic.judgment_id = tmju.judgment_id
                                                  left join lateral (
                                                      select 
                                                        trh4ick.* 
                                                      from 
                                                        ${table.tb_r_history_4s_item_check_kanbans} trh4ick
                                                        join ${table.tb_r_4s_sub_schedules} tr4ss on trh4ick.sub_schedule_id = tr4ss.sub_schedule_id
                                                      where 
                                                        trh4ick.item_check_kanban_id = tmic.item_check_kanban_id 
                                                        and trh4ick.standart_time is not null
                                                        and tr4ss.plan_time::date < '${subScheduleQuery.plan_time}'::date  /* determine check sheet history should only fetch when created history greater than equal schedule date */
                                                      order by 
                                                        trh4ick.created_dt desc 
                                                      limit 1
                                                  ) trh4ic on true
                                              where
                                                  tmk.kanban_id = '${subScheduleQuery.kanban_real_id}'
                                                  and tmic.deleted_dt is null
                                              order by 
                                                tmic.created_dt`;

            const itemCheckKanbans = await queryCustom(sqlItemCheckKanbans);

            itemCheckKanbans.rows = await Promise.all(itemCheckKanbans.rows.map(async (item) => {
                if (item.schedule_item_check_kanban_id) {
                    const findings = await queryGET(
                        table.v_4s_finding_list,
                        `where 
              deleted_dt is null 
              and schedule_item_check_kanban_id = '${item.schedule_item_check_kanban_id}'
              and sub_schedule_id = '${subScheduleQuery.sub_schedule_id}'`
                    );
                    if (findings.length > 0) {
                        item.findings = findings.map((item) => {
                            item.kaizen_file = item.kaizen_file ? `${process.env.APP_HOST}/file?path=${item.kaizen_file}` : null;
                            return item;
                        }).reverse();
                    } else {
                        item.findings = []
                    }
                } else {
                    item.findings = []
                }

                return item;
            }));

            subScheduleQuery.item_check_kanbans = itemCheckKanbans.rows
            subScheduleQuery.main_schedule_id = subScheduleQuery.main_schedule_uuid

            delete subScheduleQuery.freq_real_id
            delete subScheduleQuery.zone_real_id
            delete subScheduleQuery.kanban_real_id
            delete subScheduleQuery.pic_real_id
            delete subScheduleQuery.main_schedule_uuid

            response.success(res, "Success to get detail 4s sub schedule", subScheduleQuery)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }

    },
    get4sCountTotalSummary: async (req, res) => {
        try {
            const { line_id } = req.query
            let { month, year } = req.query

            if (!month || month == null || month == -1) {
                month = moment().format('MM')
            }

            if (!year || year == null || year == -1) {
                year = moment().format('YYYY')
            }

            const baseSql = (alias, where) => {
                const byLineId = (line_id && line_id != -1) ? `and tr4sms.line_id = (SELECT line_id FROM ${table.tb_m_lines} WHERE uuid = '${line_id}')` : ''

                return `
                select
                     count(*)::real as ${alias}
                 from
                     ${table.tb_r_4s_sub_schedules} tr4sss
                         join ${table.tb_r_4s_main_schedules} tr4sms on tr4sss.main_schedule_id = tr4sms.main_schedule_id
                 where
                         (EXTRACT(month from tr4sss.plan_time), EXTRACT(year from tr4sss.plan_time)) = (${+month},${+year})
                   and   tr4sss.deleted_by IS NULL
                   ${byLineId}
                   ${where}
              `
            }

            const delay = baseSql(
                'delay',
                `and actual_time is null and date(tr4sss.plan_time) < current_date`
            )

            const progress = baseSql(
                'progress',
                `and actual_time is null and date(tr4sss.actual_time) >= current_date`
            )

            const done = baseSql(
                'done',
                `and actual_time is not null and date(tr4sss.actual_time) >= current_date`
            )

            $sql = `
        with 
          delay as (${delay}),
          progress as (${progress}),
          done as (${done})
        select * from delay, progress, done
      `

            let result = (await queryCustom($sql, false)).rows
            if (result.length > 0) {
                result = result[0]
                /* const copy = []
                for (var key of Object.keys(result))
                {
                  copy.push({ [key]: result[key] })
                }

                result = copy */
            } else {
                result = {}
            }
            response.success(res, 'Success to count total summary 4s', result)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    edi4sSubSchedule: async (req, res) => {
        try {
            // Get sub_schedule info via UUID (for kanban/zone/freq/main context)
            const checkSql = `
              select s.sub_schedule_id, s.main_schedule_id, s.kanban_id, s.zone_id, s.freq_id, 
                     s.schedule_id, s.actual_time, s.plan_time, s.pic_id, s.actual_pic_id,
                     ms.line_id, ms.group_id, m.date as schedule_date
              from ${table.tb_r_4s_sub_schedules} s
              join ${table.tb_r_4s_main_schedules} ms on s.main_schedule_id = ms.main_schedule_id
              left join ${table.tb_m_schedules} m on s.schedule_id = m.schedule_id
              where s.uuid = '${req.params.id}' limit 1
            `
            let schedulRow = await queryCustom(checkSql, false)
            if (!schedulRow || schedulRow.rows.length == 0) {
                response.failed(res, "Error to edit 4s planning schedule, can't find schedule data")
                return
            }
            schedulRow = schedulRow.rows[0]

            const body = {}
            if (req.body.pic_id) body.pic_id = `(select user_id from ${table.tb_m_users} where uuid = '${req.body.pic_id}')`
            if (req.body.actual_pic_id) body.actual_pic_id = `(select user_id from ${table.tb_m_users} where uuid = '${req.body.actual_pic_id}')`
            if (req.body.actual_date) body.actual_time = req.body.actual_date

            await queryTransaction(async (db) => {
                const attrsUpdate = await attrsUserUpdateData(req, body)

                if (req.body.plan_date) {
                    // before_plan_date = the COLUMN DATE user clicked in calendar (reliable source of truth)
                    const sourceDateStr = req.body.before_plan_date
                    if (!sourceDateStr) throw "before_plan_date is required"

                    const planDateUpdate = moment(req.body.plan_date, 'YYYY-MM-DD')
                    const previousDate = moment(sourceDateStr, 'YYYY-MM-DD')

                    if (!planDateUpdate.isValid()) throw "Format plan_date tidak valid"
                    if (!previousDate.isValid()) throw "Format before_plan_date tidak valid"

                    req.body.plan_date = planDateUpdate.format('YYYY-MM-DD')
                    const sourceDateStrParsed = previousDate.format('YYYY-MM-DD')

                    if (planDateUpdate.isBefore(previousDate, 'month')) throw "Can't edit schedule plan to a previous month"
                    if (planDateUpdate.format('YYYY-MM-DD') === previousDate.format('YYYY-MM-DD')) throw "Tanggal tujuan tidak boleh sama dengan tanggal asal"

                    // Find the ACTUAL source row: the row with plan_time on the clicked date
                    // This handles UUID desync where the UUID points to a wrong row
                    const actualSourceRow = await db.query(`
                        SELECT s.sub_schedule_id, s.actual_time, s.pic_id, s.actual_pic_id, s.main_schedule_id
                        FROM ${table.tb_r_4s_sub_schedules} s
                        JOIN ${table.tb_m_schedules} m ON s.schedule_id = m.schedule_id
                        WHERE s.kanban_id = $1
                          AND s.zone_id = $2
                          AND s.freq_id = $3
                          AND m.date = $4
                          AND s.plan_time IS NOT NULL
                        ORDER BY s.changed_dt DESC NULLS LAST
                        LIMIT 1
                    `, [schedulRow.kanban_id, schedulRow.zone_id, schedulRow.freq_id, sourceDateStrParsed])

                    let srcSubScheduleId, srcActualTime, srcPicId, srcActualPicId, srcMainScheduleId
                    if (actualSourceRow.rowCount > 0) {
                        const s = actualSourceRow.rows[0]
                        srcSubScheduleId = s.sub_schedule_id
                        srcActualTime = s.actual_time
                        srcPicId = s.pic_id
                        srcActualPicId = s.actual_pic_id
                        srcMainScheduleId = s.main_schedule_id
                    } else {
                        throw `Tidak ada schedule yang terjadwal pada tanggal ${sourceDateStrParsed}`
                    }

                    // Get target schedule_id
                    const targetScheduleDate = await db.query(`select schedule_id from ${table.tb_m_schedules} where "date" = $1 limit 1`, [req.body.plan_date])
                    if (targetScheduleDate.rowCount === 0) throw "Target date is not a valid schedule date in the system"

                    // Handle cross-month
                    let targetMainScheduleId = srcMainScheduleId
                    if (planDateUpdate.month() > previousDate.month() || planDateUpdate.year() > previousDate.year()) {
                        const checkHeader = await db.query(`
                            select main_schedule_id from ${table.tb_r_4s_main_schedules} 
                            where year_num = $1 and month_num = $2
                            and line_id = $3 and group_id = $4 limit 1
                        `, [planDateUpdate.year(), planDateUpdate.month() + 1, schedulRow.line_id, schedulRow.group_id])
                        if (checkHeader.rowCount > 0) {
                            targetMainScheduleId = checkHeader.rows[0].main_schedule_id
                        } else {
                            const newHeader = await db.query(`
                                insert into ${table.tb_r_4s_main_schedules}
                                (uuid, line_id, group_id, year_num, month_num, created_by, created_dt, changed_by, changed_dt)
                                values ($1, $2, $3, $4, $5, $6, NOW(), $6, NOW())
                                returning main_schedule_id
                            `, [req.uuid(), schedulRow.line_id, schedulRow.group_id, planDateUpdate.year(), planDateUpdate.month() + 1, req.user.fullname])
                            targetMainScheduleId = newHeader.rows[0].main_schedule_id
                        }
                    }

                    // Check if there is already a planned schedule on the target date
                    const checkPlannedSlotRes = await db.query(`
                        select sub_schedule_id from ${table.tb_r_4s_sub_schedules}
                        where main_schedule_id = $1
                          and freq_id = $2
                          and zone_id = $3
                          and kanban_id = $4
                          and schedule_id = $5
                          and plan_time is not null
                        limit 1
                    `, [targetMainScheduleId, schedulRow.freq_id, schedulRow.zone_id, schedulRow.kanban_id, targetScheduleDate.rows[0].schedule_id])

                    if (checkPlannedSlotRes.rowCount > 0) {
                        throw "Jadwal untuk Kanban ini pada tanggal tujuan sudah terdaftar."
                    }

                    // Find target slot (empty slot for target date)
                    const targetSlotRes = await db.query(`
                        select sub_schedule_id from ${table.tb_r_4s_sub_schedules}
                        where main_schedule_id = $1
                          and freq_id = $2
                          and zone_id = $3
                          and kanban_id = $4
                          and schedule_id = $5
                          and plan_time is null
                        limit 1
                    `, [targetMainScheduleId, schedulRow.freq_id, schedulRow.zone_id, schedulRow.kanban_id, targetScheduleDate.rows[0].schedule_id])

                    let targetSubScheduleId
                    if (targetSlotRes.rowCount > 0) {
                        targetSubScheduleId = targetSlotRes.rows[0].sub_schedule_id
                    } else {
                        // Insert new slot if doesn't exist
                        const ins = await db.query(`
                            INSERT INTO ${table.tb_r_4s_sub_schedules}
                            (uuid, main_schedule_id, kanban_id, zone_id, freq_id, schedule_id, created_by, created_dt)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                            RETURNING sub_schedule_id
                        `, [req.uuid(), targetMainScheduleId, schedulRow.kanban_id, schedulRow.zone_id, schedulRow.freq_id, targetScheduleDate.rows[0].schedule_id, req.user.fullname])
                        targetSubScheduleId = ins.rows[0].sub_schedule_id
                    }

                    const actualTimeStr = srcActualTime ? `'${moment(srcActualTime).format('YYYY-MM-DD HH:mm:ss')}'` : 'null'
                    const picIdStr = srcPicId ? `'${srcPicId}'` : 'null'
                    const actualPicIdStr = srcActualPicId ? `'${srcActualPicId}'` : 'null'

                    // Set target slot with plan_time + copied data
                    await db.query(`
                        UPDATE ${table.tb_r_4s_sub_schedules}
                        SET plan_time = '${req.body.plan_date}', actual_time = ${actualTimeStr}, pic_id = ${picIdStr}, actual_pic_id = ${actualPicIdStr},
                            changed_by = '${req.user.fullname}', changed_dt = NOW()
                        WHERE sub_schedule_id = '${targetSubScheduleId}'
                    `)

                    // Clear source slot
                    await db.query(`
                        UPDATE ${table.tb_r_4s_sub_schedules}
                        SET plan_time = null, actual_time = null, actual_pic_id = null,
                            changed_by = '${req.user.fullname}', changed_dt = NOW()
                        WHERE sub_schedule_id = '${srcSubScheduleId}'
                    `)

                    // Move related records
                    await db.query(`UPDATE ${table.tb_r_4s_schedule_item_check_kanbans} SET sub_schedule_id = '${targetSubScheduleId}', checked_date = '${req.body.plan_date}' WHERE sub_schedule_id = '${srcSubScheduleId}'`)
                    await db.query(`UPDATE ${table.tb_r_4s_findings} SET sub_schedule_id = '${targetSubScheduleId}', finding_date = '${req.body.plan_date}' WHERE sub_schedule_id = '${srcSubScheduleId}'`)

                } else {
                    await queryPutTransaction(db, table.tb_r_4s_sub_schedules, attrsUpdate, `WHERE sub_schedule_id = '${schedulRow.sub_schedule_id}'`)
                }
            })

            response.success(res, "Success to edit 4s schedule plan")
        } catch (error) {
            console.log("Error in edi4sSubSchedule:", error)
            response.failed(res, error || "Error to edit 4s sub schedule")
        }
    },
    sign4sSchedule: async (req, res) => {
        try {

            const sign_checker_id = req.params.sign_checker_id
            if (sign_checker_id.toLowerCase() === "createnew") {
                const date = req.body.date;
                const attrsInsert = await attrsUserInsertData(req, req.body);
                if (new Map(Object.entries(attrsInsert)).has('date')) {
                    delete attrsInsert.date;
                }

                await queryPOST(
                    table.tb_r_4s_schedule_sign_checkers,
                    {
                        ...attrsInsert,
                        uuid: req.uuid(),
                        main_schedule_id: `(select main_schedule_id from ${table.tb_r_4s_main_schedules} where uuid = '${req.body.main_schedule_id}')`,
                        start_date: date,
                        end_date: date,
                        sign: req.body.sign,
                        is_tl_1: req.body.is_tl_1,
                        is_gl: req.body.is_gl,
                        is_sh: req.body.is_sh,
                    }
                );

                response.success(res, 'success to sign 4s schedule', [])
                return;
            }

            let signCheckerQuery = await queryCustom(
                `
          select
            tr4ssc.sign,
            tr4ssc.is_tl_1,
            tr4ssc.is_tl_2,
            tr4ssc.is_gl,
            tr4ssc.is_sh,
            tr4sm.uuid as main_schedule_uuid
          from
            ${table.tb_r_4s_schedule_sign_checkers} tr4ssc
            join ${table.tb_r_4s_main_schedules} tr4sm on tr4ssc.main_schedule_id = tr4sm.main_schedule_id
          where 
            tr4ssc.uuid = '${sign_checker_id}'
        `,
                false
            )

            if (!signCheckerQuery || signCheckerQuery.length == 0) {
                throw "invalid params, unknown data"
            }

            delete req.body.main_schedule_id
            delete req.body.date
            delete req.body.is_tl_1
            delete req.body.is_tl_2
            delete req.body.is_gl
            delete req.body.is_sh

            let attrsUpdate = await attrsUserUpdateData(req, req.body)
            await queryPUT(table.tb_r_4s_schedule_sign_checkers, attrsUpdate, `WHERE uuid = '${sign_checker_id}'`)

            cacheDelete(signCheckerQuery.rows[0].main_schedule_uuid)

            response.success(res, 'success to sign 4s schedule', [])
        } catch (e) {
            console.log(e)
            response.failed(res, "Error to sign 4s schedule")
        }
    },
    delete4sMainSchedule: async (req, res) => {
        try {
            await database.query(`
                UPDATE ${table.tb_r_4s_main_schedules}
                SET deleted_dt = CURRENT_TIMESTAMP,
                    deleted_by = $1
                WHERE uuid = $2
            `, [req.user.fullname, req.params.id])
            response.success(res, 'success to delete 4s main schedule', [])
        } catch (e) {
            console.log(e)
            response.failed(res, "Error to delete 4s main schedule")
        }
    },
    delete4sSubSchedule: async (req, res) => {
        try {
            let subScheduleRow = await database.query(
                `
          select 
            tr4ss.*,
            tr4sm.uuid as main_schedule_uuid,
            tr4sm.group_id,
            tr4sm.line_id,
            tr4sm.year_num ||'-'|| trim(to_char(tr4sm.month_num, '00')) as month_year_num
          from 
            ${table.tb_r_4s_sub_schedules} tr4ss
            join ${table.tb_r_4s_main_schedules} tr4sm on tr4ss.main_schedule_id = tr4sm.main_schedule_id
          where 
            tr4ss.uuid = $1
        `, [req.params.id]
            )

            if (!subScheduleRow || subScheduleRow.rowCount === 0) {
                response.failed(
                    res,
                    "Error to delete 4s sub schedule, can't find schedule data"
                )
                return
            }

            subScheduleRow = subScheduleRow.rows[0]

            const transaction = await queryTransaction(async (db) => {
                const updateSql = `update ${table.tb_r_4s_sub_schedules}
                            set 
                              plan_time = null,
                              actual_time = null,
                              actual_pic_id = null,
                              changed_by = '${req.user.fullname}',
                              changed_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}'
                            where
                              sub_schedule_id = '${subScheduleRow.sub_schedule_id}'
                            returning *`;
                let result = await db.query(updateSql);
                if (result.rowCount) {
                    result = result.rows[0];
                }

                //region find previous 1 month schedule, used previous updatecondition value before reinit
                /*const findAvailPlanTimeSql = `select
                                                *
                                              from
                                                ${table.tb_r_4s_sub_schedules}
                                              where
                                                ${updateCondition}
                                                and plan_time is not null`
                console.log('findAvailPlanTimeSql', findAvailPlanTimeSql);
                const findAvailPlanTimeQuery = await db.query(findAvailPlanTimeSql)
                console.log('findAvailPlanTime lenght', findAvailPlanTimeQuery.rowCount);
                if (findAvailPlanTimeQuery.rowCount == 0)
                {
                  //delete if plan time null
                  await db.query(`delete from ${table.tb_r_4s_sub_schedules} where ${updateCondition}`)
                }*/
                //endregion

                //region delete itemcheck kanban & finding
                await db.query(`delete from ${table.tb_r_4s_findings} where sub_schedule_id = '${result.sub_schedule_id}'`);
                await db.query(`delete from ${table.tb_r_4s_schedule_item_check_kanbans} where sub_schedule_id = '${result.sub_schedule_id}'`);
                //endregion

                return result
            });

            cacheDelete(subScheduleRow.main_schedule_uuid)

            response.success(res, 'success to delete 4s sub schedule', transaction)
        } catch (e) {
            console.log(e)
            response.failed(res, "Error to delete 4s sub schedule")
        }
    },
    add4sSubPlanPic: async (req, res) => {
        try {
            let sub_schedule_id = req.params.id

            const main_schedule_raw = await database.query(`SELECT main_schedule_id, kanban_id FROM ${table.tb_r_4s_sub_schedules} WHERE uuid = $1`, [sub_schedule_id])
            console.log(main_schedule_raw);
            if (main_schedule_raw.rowCount === 0) return response.failed(res, "Error to add 4s sub schedule, can't find main schedule data")

            const { main_schedule_id, kanban_id } = main_schedule_raw.rows[0]
            const result = await database.query(`
                UPDATE ${table.tb_r_4s_sub_schedules}
                SET pic_id = (select user_id from ${table.tb_m_users} where uuid = $1),
                    changed_by = $2,
                    changed_dt = $3
                WHERE main_schedule_id = $4 and kanban_id = $5 and actual_pic_id is null RETURNING *
            `, [req.body.pic_id, req.user.fullname, moment().format('YYYY-MM-DD HH:mm:ss'), main_schedule_id, kanban_id])
            // console.log(result.rows[0]);

            const { created_dt } = result.rows[0]
            await queryCustom(`
                UPDATE tb_r_4s_sub_schedules s
                SET pic_id = src.pic_id
                FROM (
                    SELECT kanban_id, 
                        DATE_PART('month', created_dt) AS month_start,
                        DATE_PART('year', created_dt) AS year_start,
                        MAX(pic_id) AS pic_id
                    FROM tb_r_4s_sub_schedules
                    WHERE 
                        pic_id IS NOT NULL and 
                        DATE_PART('month', created_dt) = ${moment(created_dt).format('M')} and 
                        DATE_PART('year', created_dt) = ${moment(created_dt).format('YYYY')}
                    GROUP BY kanban_id, DATE_PART('month', created_dt), DATE_PART('year', created_dt)
                ) src
                WHERE s.kanban_id = src.kanban_id
                AND DATE_PART('month', s.plan_time) = src.month_start
                AND DATE_PART('year', plan_time) = src.year_start
                AND (s.pic_id IS NULL)
            `)

            const main_schedule_uuid_query = await queryGET(table.tb_r_4s_main_schedules, `WHERE main_schedule_id = '${main_schedule_id}' `, ['uuid']);
            const main_schedule_uuid = main_schedule_uuid_query[0]?.uuid;
            if (main_schedule_uuid) {
                cacheDelete(main_schedule_uuid);
            }

            response.success(res, 'Success to add plan pic 4s sub schedule', [])
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to add plan pic 4s sub schedule")
        }
    },
    addSubSchedule: async (req, res) => {
        try {
            /*
                uuid,
                main_schedule_id,
                kanban_id, V
                freq_id, V
                zone_id, V
                schedule_id, V
                plan_time, V
                shift_type, V
                is_holiday, V
                created_by,
                created_dt,
                changed_by,
                changed_dt
            */
            await queryTransaction(async (db) => {
                // 1. get main schedules
                const { selectedDate, selectedLine, selectedGroup, selectedKanban } = req.body
                const month = moment(selectedDate).format('M')
                const year = moment(selectedDate).format('YYYY')
                console.log(req.body);
                const kanbanID = selectedKanban?.id
                if (!kanbanID) {
                    throw new Error("Data Kanban tidak ditemukan.")
                }

                const payload = {
                    group_id: `(select group_id from ${table.tb_m_groups} where uuid = '${selectedGroup}')`,
                    line_id: `(select line_id from ${table.tb_m_lines} where uuid = '${selectedLine}')`,
                    month_num: month,
                    year_num: year
                }
                // db.query(`SET session_replication_role = 'replica'`)
                const mainScheduleQuery = await db.query(`select * from ${table.tb_r_4s_main_schedules} where group_id = (select group_id from ${table.tb_m_groups} where uuid = $1) and line_id = (select line_id from ${table.tb_m_lines} where uuid = $2) and month_num = $3 and year_num = $4 limit 1`, [selectedGroup, selectedLine, payload.month_num, payload.year_num])
                if (mainScheduleQuery.rows.length === 0) {
                    throw new Error("Jadwal Utama (Main Schedule) tidak ditemukan untuk Line dan Shift di bulan ini.")
                }
                const mainSchedule = mainScheduleQuery.rows[0].main_schedule_id
                const mainGroupId = mainScheduleQuery.rows[0].group_id
                const mainLineId = mainScheduleQuery.rows[0].line_id
                console.log(mainSchedule, 'Main sche');

                // 2. get m schedule (is_holiday, schedule_id)
                const getScheduleId = await db.query(`select schedule_id, is_holiday from ${table.tb_m_schedules} where date between $1 and $1 limit 1`, [req.body.selectedDate])
                // console.log(getScheduleId);
                console.log(getScheduleId, 'getScheduleId');
                if (getScheduleId.rows.length === 0) {
                    throw new Error("Data Jadwal Harian (Schedule) tidak ditemukan.")
                }
                const { schedule_id, is_holiday } = getScheduleId.rows[0]

                // 3. get m shifts (shift_type) : selectedDate
                const getShiftType = await db.query(`select shift_type from ${table.tb_m_shifts} where start_date <= $1 and end_date >= $1 and group_id = (select group_id from ${table.tb_m_groups} where uuid = $2) limit 1`, [req.body.selectedDate, selectedGroup])
                console.log(getShiftType, 'getShiftType');

                const shiftType = getShiftType.rows[0]?.shift_type


                // 4. get Kanban (kanban_id, zone_id, freq_id)
                const getKanban = await db.query(`
                    select tmk.kanban_id, tmk.zone_id, tmk.freq_id, tmk.group_id, tmz.line_id 
                    from ${table.tb_m_kanbans} tmk
                    join ${table.tb_m_zones} tmz on tmk.zone_id = tmz.zone_id
                    where tmk.uuid = $1 limit 1
                `, [kanbanID])
                console.log(getKanban, 'getKanban');
                if (getKanban.rows.length === 0) {
                    throw new Error("Data Kanban tidak ditemukan.")
                }
                const { kanban_id, zone_id, freq_id, group_id, line_id } = getKanban.rows[0]

                // Validate Shift / Group
                if (group_id !== mainGroupId) {
                    throw new Error("Shift Kanban tidak sesuai dengan Shift jadwal yang dipilih.")
                }

                // Validate Line
                if (line_id !== mainLineId) {
                    throw new Error("Line Kanban tidak sesuai dengan Line jadwal yang dipilih.")
                }

                // Validate uniqueness of sub schedule (no duplicate kanban_id + schedule_id)
                const getExistSub = await db.query(`
                    select sub_schedule_id 
                    from ${table.tb_r_4s_sub_schedules} 
                    where kanban_id = $1 and schedule_id = $2 limit 1
                `, [kanban_id, schedule_id])
                if (getExistSub.rows.length > 0) {
                    throw new Error("Jadwal untuk Kanban ini pada tanggal tersebut sudah terdaftar.")
                }

                const insertPayload = {
                    sub_schedule_id: `(select COALESCE(MAX(sub_schedule_id), 0) + 1 FROM ${table.tb_r_4s_sub_schedules})`,
                    uuid: req.uuid(),
                    main_schedule_id: mainSchedule,
                    kanban_id: kanban_id,
                    freq_id: freq_id,
                    zone_id: zone_id,
                    schedule_id: schedule_id,
                    plan_time: req.body.selectedDate,
                    shift_type: shiftType || null,
                    is_holiday: is_holiday,
                    created_by: req.user.fullname,
                    created_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
                    changed_by: req.user.fullname,
                    changed_dt: moment().format('YYYY-MM-DD HH:mm:ss')
                }

                console.log(insertPayload, 'Insert Payload');
                console.log(`insert into ${table.tb_r_4s_sub_schedules} (
                    sub_schedule_id,
                    uuid,
                    main_schedule_id,
                    kanban_id,
                    freq_id,
                    zone_id,
                    schedule_id,
                    plan_time,
                    shift_type,
                    is_holiday,
                    created_by,
                    created_dt,
                    changed_by,
                    changed_dt
                ) values (
                    ${insertPayload.sub_schedule_id},
                    '${insertPayload.uuid}',
                    ${insertPayload.main_schedule_id},
                    ${insertPayload.kanban_id},
                    ${insertPayload.freq_id},
                    ${insertPayload.zone_id},
                    ${insertPayload.schedule_id},
                    '${insertPayload.plan_time}',
                    '${insertPayload.shift_type}',
                    ${insertPayload.is_holiday},
                    '${insertPayload.created_by}',
                    '${insertPayload.created_dt}',
                    '${insertPayload.changed_by}',
                    '${insertPayload.changed_dt}'
                )`);
                const result = await db.query(`insert into ${table.tb_r_4s_sub_schedules} (
                    sub_schedule_id,
                    uuid,
                    main_schedule_id,
                    kanban_id,
                    freq_id,
                    zone_id,
                    schedule_id,
                    plan_time,
                    shift_type,
                    is_holiday,
                    created_by,
                    created_dt,
                    changed_by,
                    changed_dt
                ) values (
                    ${insertPayload.sub_schedule_id},
                    '${insertPayload.uuid}',
                    ${insertPayload.main_schedule_id},
                    ${insertPayload.kanban_id},
                    ${insertPayload.freq_id},
                    ${insertPayload.zone_id},
                    ${insertPayload.schedule_id},
                    '${insertPayload.plan_time}',
                    '${insertPayload.shift_type}',
                    ${insertPayload.is_holiday},
                    '${insertPayload.created_by}',
                    '${insertPayload.created_dt}',
                    '${insertPayload.changed_by}',
                    '${insertPayload.changed_dt}'
                )`)
                console.log(result, 'Result');
                return true
            })

            response.success(res, 'Success to add sub schedule')

        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    getMonthlyPicConfig: async (req, res) => {
        try {
            const startTime = Date.now();
            const { line_uuid, group_uuid, month, year } = req.query;

            const uuidRegex = /^[0-9a-fA-F-]{32,36}$/;
            if (!line_uuid || !uuidRegex.test(line_uuid) || !group_uuid || !uuidRegex.test(group_uuid)) {
                return response.failed(res, "Invalid line_uuid or group_uuid format");
            }

            const parsedMonth = parseInt(month);
            const parsedYear = parseInt(year);
            if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12 || isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
                return response.failed(res, "Invalid month or year");
            }

            // Step 1: Resolve UUIDs to IDs once and get main_schedule_id + sub_schedule count in a SINGLE query
            const t1 = Date.now();
            const initQuery = await database.query(`
                select 
                    tml.line_id,
                    tmg.group_id,
                    tms.main_schedule_id,
                    (
                        select count(*)::integer 
                        from ${table.tb_r_4s_sub_schedules} 
                        where main_schedule_id = tms.main_schedule_id
                    ) as sub_count
                from ${table.tb_m_lines} tml
                cross join ${table.tb_m_groups} tmg
                left join ${table.tb_r_4s_main_schedules} tms 
                    on tms.line_id = tml.line_id 
                    and tms.group_id = tmg.group_id
                    and tms.month_num = $3
                    and tms.year_num = $4
                where tml.uuid = $1 and tmg.uuid = $2
                limit 1
            `, [line_uuid, group_uuid, parsedMonth, parsedYear]);
            console.log(`[PIC Config] Step 1 (init query): ${Date.now() - t1}ms`);

            if (initQuery.rowCount === 0) {
                return response.failed(res, "Invalid line or group");
            }

            let { line_id, group_id, main_schedule_id, sub_count } = initQuery.rows[0];

            // Step 2: Generate schedule on-the-fly if no sub-schedules exist
            if (!main_schedule_id || sub_count === 0) {
                try {
                    const t2 = Date.now();
                    const generateSchedule = require('../../schedulers/4s.scheduler');
                    await generateSchedule(parsedYear, parsedMonth, line_id, group_id);
                    console.log(`[PIC Config] Step 2 (generate schedule): ${Date.now() - t2}ms`);

                    // Re-fetch main_schedule_id after generation
                    const reQuery = await database.query(`
                        select main_schedule_id from ${table.tb_r_4s_main_schedules}
                        where line_id = $1 and group_id = $2 and month_num = $3 and year_num = $4
                        limit 1
                    `, [line_id, group_id, parsedMonth, parsedYear]);

                    if (reQuery.rowCount === 0) {
                        return response.success(res, "No main schedule found", { list: [] });
                    }
                    main_schedule_id = reQuery.rows[0].main_schedule_id;
                } catch (genErr) {
                    console.log('Error generating schedule on-the-fly:', genErr);
                    return response.success(res, "No main schedule found", { list: [] });
                }
            }

            // Step 3: Fetch kanbans - optimized without LATERAL join
            const t3 = Date.now();
            const kanbans = await database.query(`
                select 
                    tmk.uuid as kanban_id,
                    tmk.kanban_no,
                    tmz.zone_nm,
                    tmk.area_nm,
                    tmf.freq_nm,
                    tmu.uuid as pic_id,
                    tmu.fullname as pic_nm,
                    tmk.kanban_id as kanban_id_int
                from (
                    select distinct on (tbrcs.kanban_id)
                        tbrcs.kanban_id,
                        tbrcs.zone_id,
                        tbrcs.freq_id,
                        tbrcs.pic_id
                    from ${table.tb_r_4s_sub_schedules} tbrcs
                    where tbrcs.main_schedule_id = $1
                    order by
                        tbrcs.kanban_id,
                        tbrcs.pic_id desc nulls last,
                        tbrcs.changed_dt desc
                ) sub
                join ${table.tb_m_kanbans} tmk on sub.kanban_id = tmk.kanban_id
                join ${table.tb_m_zones} tmz on sub.zone_id = tmz.zone_id
                join ${table.tb_m_freqs} tmf on sub.freq_id = tmf.freq_id
                left join ${table.tb_m_users} tmu on tmu.user_id = sub.pic_id
            `, [main_schedule_id]);
            console.log(`[PIC Config] Step 3 (fetch kanbans): ${Date.now() - t3}ms, rows: ${kanbans.rowCount}`);

            // Step 4: Batch fetch standart_time for all kanban_ids at once
            const t4 = Date.now();
            const kanbanIds = kanbans.rows.map(r => r.kanban_id_int);
            let standartTimeMap = {};

            if (kanbanIds.length > 0) {
                const stQuery = await database.query(`
                    select kanban_id, sum(standart_time)::real as standart_time
                    from ${table.tb_m_4s_item_check_kanbans}
                    where kanban_id = ANY($1)
                    group by kanban_id
                `, [kanbanIds]);

                stQuery.rows.forEach(r => {
                    standartTimeMap[r.kanban_id] = r.standart_time;
                });
            }
            console.log(`[PIC Config] Step 4 (standart_time batch): ${Date.now() - t4}ms`);

            // Merge standart_time into result and remove internal kanban_id_int
            const result = kanbans.rows.map(r => {
                const { kanban_id_int, ...rest } = r;
                return {
                    ...rest,
                    standart_time: standartTimeMap[kanban_id_int] || null
                };
            });

            console.log(`[PIC Config] Total: ${Date.now() - startTime}ms`);
            response.success(res, 'Success to fetch monthly PIC config', { list: result })
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to get monthly PIC config")
        }
    },
    updateMonthlyPicConfig: async (req, res) => {
        try {
            const { line_uuid, group_uuid, month, year } = req.query;
            const { mappings } = req.body;

            const uuidRegex = /^[0-9a-fA-F-]{32,36}$/;
            if (!line_uuid || !uuidRegex.test(line_uuid) || !group_uuid || !uuidRegex.test(group_uuid)) {
                return response.failed(res, "Invalid line_uuid or group_uuid format");
            }

            const parsedMonth = parseInt(month);
            const parsedYear = parseInt(year);
            if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12 || isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
                return response.failed(res, "Invalid month or year");
            }

            if (!Array.isArray(mappings)) {
                return response.failed(res, "Mappings must be an array");
            }

            const checkSubSchedules = await database.query(`
                select count(*)::integer as count 
                from ${table.tb_r_4s_sub_schedules} tbrcs
                where tbrcs.main_schedule_id = (
                    select main_schedule_id from ${table.tb_r_4s_main_schedules} 
                    where line_id = (select line_id from ${table.tb_m_lines} where uuid = $1)
                      and group_id = (select group_id from ${table.tb_m_groups} where uuid = $2)
                      and month_num = $3
                      and year_num = $4
                    limit 1
                )
                  and tbrcs.deleted_dt is null
            `, [line_uuid, group_uuid, parsedMonth, parsedYear]);
            const subSchedulesCount = checkSubSchedules.rows[0]?.count || 0;

            if (subSchedulesCount === 0) {
                try {
                    const idsQuery = await database.query(`
                        select 
                            (select line_id from ${table.tb_m_lines} where uuid = $1) as line_id,
                            (select group_id from ${table.tb_m_groups} where uuid = $2) as group_id
                    `, [line_uuid, group_uuid]);
                    const { line_id, group_id } = idsQuery.rows[0];

                    const generateSchedule = require('../../schedulers/4s.scheduler');
                    await generateSchedule(parsedYear, parsedMonth, line_id, group_id);
                } catch (genErr) {
                    console.log('Error generating schedule on-the-fly during save:', genErr);
                    return response.failed(res, "Main schedule not found and failed to generate");
                }
            }

            const queryRes = await database.query(`
                select main_schedule_id, uuid from ${table.tb_r_4s_main_schedules} 
                where line_id = (select line_id from ${table.tb_m_lines} where uuid = $1)
                  and group_id = (select group_id from ${table.tb_m_groups} where uuid = $2)
                  and month_num = $3
                  and year_num = $4
                limit 1
            `, [line_uuid, group_uuid, parsedMonth, parsedYear])

            if (queryRes.rowCount === 0) {
                return response.failed(res, "Main schedule not found")
            }
            const { main_schedule_id, uuid: main_schedule_uuid } = queryRes.rows[0];

            await queryTransaction(async (db) => {
                for (const mapping of mappings) {
                    const { kanban_id, pic_id } = mapping;
                    if (!kanban_id || !uuidRegex.test(kanban_id)) {
                        continue;
                    }

                    if (pic_id && uuidRegex.test(pic_id)) {
                        await db.query(`
                            update ${table.tb_r_4s_sub_schedules}
                            set pic_id = (select user_id from ${table.tb_m_users} where uuid = $1),
                                changed_by = $2,
                                changed_dt = NOW()
                            where main_schedule_id = $3
                              and kanban_id = (select kanban_id from ${table.tb_m_kanbans} where uuid = $4)
                              and actual_pic_id is null
                        `, [pic_id, req.user.fullname, main_schedule_id, kanban_id]);
                    } else {
                        await db.query(`
                            update ${table.tb_r_4s_sub_schedules}
                            set pic_id = null,
                                changed_by = $1,
                                changed_dt = NOW()
                            where main_schedule_id = $2
                              and kanban_id = (select kanban_id from ${table.tb_m_kanbans} where uuid = $3)
                              and actual_pic_id is null
                        `, [req.user.fullname, main_schedule_id, kanban_id]);
                    }
                }
            });

            if (main_schedule_uuid) {
                cacheDelete(main_schedule_uuid);
            }

            response.success(res, 'Success to update monthly PIC configuration')
        } catch (error) {
            console.log(error)
            response.failed(res, "Error to update monthly PIC configuration")
        }
    },

    getMemberRotations: async (req, res) => {
        try {
            const { line_uuid, group_uuid, year } = req.query;
            const uuidRegex = /^[0-9a-fA-F-]{32,36}$/;
            if (!line_uuid || !uuidRegex.test(line_uuid) || !group_uuid || !uuidRegex.test(group_uuid)) {
                return response.failed(res, "Invalid line_uuid or group_uuid format");
            }
            const parsedYear = parseInt(year);
            if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
                return response.failed(res, "Invalid year");
            }

            const queryResult = await database.query(`
                WITH resolved_ids AS (
                    SELECT 
                        (SELECT line_id FROM ${table.tb_m_lines} WHERE uuid = $2) as line_id,
                        (SELECT group_id FROM ${table.tb_m_groups} WHERE uuid = $3) as group_id
                ),
                year_schedules AS (
                    SELECT ms.main_schedule_id, ms.month_num
                    FROM ${table.tb_r_4s_main_schedules} ms
                    JOIN resolved_ids ri ON ms.line_id = ri.line_id AND ms.group_id = ri.group_id
                    WHERE ms.year_num = $1
                ),
                pic_per_month AS (
                    SELECT DISTINCT ON (ys.month_num, ss.kanban_id)
                        ys.month_num,
                        ss.kanban_id,
                        ss.pic_id
                    FROM year_schedules ys
                    JOIN ${table.tb_r_4s_sub_schedules} ss 
                        ON ss.main_schedule_id = ys.main_schedule_id
                    WHERE ss.deleted_dt IS NULL
                    ORDER BY ys.month_num, ss.kanban_id, ss.changed_dt DESC
                )
                SELECT 
                    tmk.uuid as kanban_id,
                    tmk.kanban_no,
                    tmz.zone_nm,
                    tmk.area_nm,
                    tmf.freq_nm,
                    tmf.color,
                    MAX(CASE WHEN ppm.month_num = 1 THEN tmu.fullname END) as month_1_pic,
                    MAX(CASE WHEN ppm.month_num = 1 THEN tmu.uuid END)::text as month_1_pic_id,
                    MAX(CASE WHEN ppm.month_num = 2 THEN tmu.fullname END) as month_2_pic,
                    MAX(CASE WHEN ppm.month_num = 2 THEN tmu.uuid END)::text as month_2_pic_id,
                    MAX(CASE WHEN ppm.month_num = 3 THEN tmu.fullname END) as month_3_pic,
                    MAX(CASE WHEN ppm.month_num = 3 THEN tmu.uuid END)::text as month_3_pic_id,
                    MAX(CASE WHEN ppm.month_num = 4 THEN tmu.fullname END) as month_4_pic,
                    MAX(CASE WHEN ppm.month_num = 4 THEN tmu.uuid END)::text as month_4_pic_id,
                    MAX(CASE WHEN ppm.month_num = 5 THEN tmu.fullname END) as month_5_pic,
                    MAX(CASE WHEN ppm.month_num = 5 THEN tmu.uuid END)::text as month_5_pic_id,
                    MAX(CASE WHEN ppm.month_num = 6 THEN tmu.fullname END) as month_6_pic,
                    MAX(CASE WHEN ppm.month_num = 6 THEN tmu.uuid END)::text as month_6_pic_id,
                    MAX(CASE WHEN ppm.month_num = 7 THEN tmu.fullname END) as month_7_pic,
                    MAX(CASE WHEN ppm.month_num = 7 THEN tmu.uuid END)::text as month_7_pic_id,
                    MAX(CASE WHEN ppm.month_num = 8 THEN tmu.fullname END) as month_8_pic,
                    MAX(CASE WHEN ppm.month_num = 8 THEN tmu.uuid END)::text as month_8_pic_id,
                    MAX(CASE WHEN ppm.month_num = 9 THEN tmu.fullname END) as month_9_pic,
                    MAX(CASE WHEN ppm.month_num = 9 THEN tmu.uuid END)::text as month_9_pic_id,
                    MAX(CASE WHEN ppm.month_num = 10 THEN tmu.fullname END) as month_10_pic,
                    MAX(CASE WHEN ppm.month_num = 10 THEN tmu.uuid END)::text as month_10_pic_id,
                    MAX(CASE WHEN ppm.month_num = 11 THEN tmu.fullname END) as month_11_pic,
                    MAX(CASE WHEN ppm.month_num = 11 THEN tmu.uuid END)::text as month_11_pic_id,
                    MAX(CASE WHEN ppm.month_num = 12 THEN tmu.fullname END) as month_12_pic,
                    MAX(CASE WHEN ppm.month_num = 12 THEN tmu.uuid END)::text as month_12_pic_id
                FROM ${table.tb_m_kanbans} tmk
                JOIN ${table.tb_m_zones} tmz ON tmk.zone_id = tmz.zone_id
                JOIN ${table.tb_m_freqs} tmf ON tmk.freq_id = tmf.freq_id
                CROSS JOIN resolved_ids ri
                LEFT JOIN pic_per_month ppm ON ppm.kanban_id = tmk.kanban_id
                LEFT JOIN ${table.tb_m_users} tmu ON tmu.user_id = ppm.pic_id
                WHERE tmz.line_id = ri.line_id
                  AND tmk.group_id = ri.group_id
                  AND tmk.deleted_dt IS NULL
                  AND tmz.zone_nm <> 'OTHERS'
                GROUP BY tmk.kanban_id, tmk.kanban_no, tmz.zone_nm, tmk.area_nm, tmf.freq_nm, tmf.color
                ORDER BY tmk.kanban_no ASC
            `, [parsedYear, line_uuid, group_uuid]);

            response.success(res, "Success to fetch member rotations", { list: queryResult.rows });
        } catch (error) {
            console.error(error);
            response.failed(res, "Error to fetch member rotations");
        }
    },

    updateMemberRotations: async (req, res) => {
        try {
            const { line_uuid, group_uuid, year } = req.query;
            const { rotations } = req.body; // array of { kanban_id, month_1_pic_id, month_2_pic_id, ... }
            const uuidRegex = /^[0-9a-fA-F-]{32,36}$/;

            if (!line_uuid || !uuidRegex.test(line_uuid) || !group_uuid || !uuidRegex.test(group_uuid)) {
                return response.failed(res, "Invalid line_uuid or group_uuid format");
            }
            const parsedYear = parseInt(year);
            if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
                return response.failed(res, "Invalid year");
            }
            if (!Array.isArray(rotations)) {
                return response.failed(res, "Rotations must be an array");
            }

            // Resolve Line and Group ids
            const idsQuery = await database.query(`
                select 
                    (select line_id from ${table.tb_m_lines} where uuid = $1) as line_id,
                    (select group_id from ${table.tb_m_groups} where uuid = $2) as group_id
            `, [line_uuid, group_uuid]);
            const { line_id, group_id } = idsQuery.rows[0];

            if (!line_id || !group_id) {
                return response.failed(res, "Invalid line or group");
            }

            // We will loop through each month 1 to 12
            for (let monthNum = 1; monthNum <= 12; monthNum++) {
                // Check if main schedule exists for this year and month. If not, generate on-the-fly.
                const checkSubSchedules = await database.query(`
                    select count(*)::integer as count 
                    from ${table.tb_r_4s_sub_schedules} tbrcs
                    where tbrcs.main_schedule_id = (
                        select main_schedule_id from ${table.tb_r_4s_main_schedules} 
                        where line_id = $1 and group_id = $2 and month_num = $3 and year_num = $4
                        limit 1
                    )
                      and tbrcs.deleted_dt is null
                `, [line_id, group_id, monthNum, parsedYear]);
                const subSchedulesCount = checkSubSchedules.rows[0]?.count || 0;

                if (subSchedulesCount === 0) {
                    try {
                        const generateSchedule = require('../../schedulers/4s.scheduler');
                        await generateSchedule(parsedYear, monthNum, line_id, group_id);
                    } catch (genErr) {
                        console.log(`[Rotation Save] Failed to generate schedule for month ${monthNum}:`, genErr);
                    }
                }

                // Get main_schedule_id and main_schedule_uuid
                const mainSchedQuery = await database.query(`
                    select main_schedule_id, uuid from ${table.tb_r_4s_main_schedules} 
                    where line_id = $1 and group_id = $2 and month_num = $3 and year_num = $4
                    limit 1
                `, [line_id, group_id, monthNum, parsedYear]);

                if (mainSchedQuery.rowCount > 0) {
                    const { main_schedule_id, uuid: main_schedule_uuid } = mainSchedQuery.rows[0];

                    await queryTransaction(async (db) => {
                        for (const rotation of rotations) {
                            const { kanban_id } = rotation;
                            const pic_uuid = rotation[`month_${monthNum}_pic_id`];

                            if (!kanban_id || !uuidRegex.test(kanban_id)) {
                                continue;
                            }

                            if (pic_uuid && uuidRegex.test(pic_uuid)) {
                                await db.query(`
                                    update ${table.tb_r_4s_sub_schedules}
                                    set pic_id = (select user_id from ${table.tb_m_users} where uuid = $1),
                                        changed_by = $2,
                                        changed_dt = NOW()
                                    where main_schedule_id = $3
                                      and kanban_id = (select kanban_id from ${table.tb_m_kanbans} where uuid = $4)
                                      and actual_pic_id is null
                                `, [pic_uuid, req.user.fullname, main_schedule_id, kanban_id]);
                            } else {
                                await db.query(`
                                    update ${table.tb_r_4s_sub_schedules}
                                    set pic_id = null,
                                        changed_by = $1,
                                        changed_dt = NOW()
                                    where main_schedule_id = $2
                                      and kanban_id = (select kanban_id from ${table.tb_m_kanbans} where uuid = $3)
                                      and actual_pic_id is null
                                `, [req.user.fullname, main_schedule_id, kanban_id]);
                            }
                        }
                    });

                    if (main_schedule_uuid) {
                        cacheDelete(main_schedule_uuid);
                    }
                }
            }

            response.success(res, 'Success to update member rotations');
        } catch (error) {
            console.error(error);
            response.failed(res, "Error to update member rotations");
        }
    },

    exportMemberRotationsToExcel: async (req, res) => {
        try {
            const { line_uuid, group_uuid, year } = req.query;
            const uuidRegex = /^[0-9a-fA-F-]{32,36}$/;
            if (!line_uuid || !uuidRegex.test(line_uuid) || !group_uuid || !uuidRegex.test(group_uuid)) {
                return response.failed(res, "Invalid line_uuid or group_uuid format");
            }
            const parsedYear = parseInt(year);
            if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
                return response.failed(res, "Invalid year");
            }

            // Resolve Line and Group
            const lineGroupQuery = await database.query(`
                select 
                    (select line_nm from ${table.tb_m_lines} where uuid = $1) as line_nm,
                    (select group_nm from ${table.tb_m_groups} where uuid = $2) as group_nm
            `, [line_uuid, group_uuid]);

            if (lineGroupQuery.rowCount === 0) {
                return response.failed(res, "Line or Group not found");
            }

            const { line_nm, group_nm } = lineGroupQuery.rows[0];

            // Fetch rotation data
            const queryResult = await database.query(`
                WITH resolved_ids AS (
                    SELECT 
                        (SELECT line_id FROM ${table.tb_m_lines} WHERE uuid = $2) as line_id,
                        (SELECT group_id FROM ${table.tb_m_groups} WHERE uuid = $3) as group_id
                ),
                year_schedules AS (
                    SELECT ms.main_schedule_id, ms.month_num
                    FROM ${table.tb_r_4s_main_schedules} ms
                    JOIN resolved_ids ri ON ms.line_id = ri.line_id AND ms.group_id = ri.group_id
                    WHERE ms.year_num = $1
                ),
                pic_per_month AS (
                    SELECT DISTINCT ON (ys.month_num, ss.kanban_id)
                        ys.month_num,
                        ss.kanban_id,
                        ss.pic_id
                    FROM year_schedules ys
                    JOIN ${table.tb_r_4s_sub_schedules} ss 
                        ON ss.main_schedule_id = ys.main_schedule_id
                    WHERE ss.deleted_dt IS NULL
                    ORDER BY ys.month_num, ss.kanban_id, ss.changed_dt DESC
                )
                SELECT 
                    tmk.kanban_no,
                    tmz.zone_nm,
                    tmk.area_nm,
                    tmf.freq_nm,
                    tmf.color,
                    MAX(CASE WHEN ppm.month_num = 1 THEN tmu.fullname END) as month_1_pic,
                    MAX(CASE WHEN ppm.month_num = 2 THEN tmu.fullname END) as month_2_pic,
                    MAX(CASE WHEN ppm.month_num = 3 THEN tmu.fullname END) as month_3_pic,
                    MAX(CASE WHEN ppm.month_num = 4 THEN tmu.fullname END) as month_4_pic,
                    MAX(CASE WHEN ppm.month_num = 5 THEN tmu.fullname END) as month_5_pic,
                    MAX(CASE WHEN ppm.month_num = 6 THEN tmu.fullname END) as month_6_pic,
                    MAX(CASE WHEN ppm.month_num = 7 THEN tmu.fullname END) as month_7_pic,
                    MAX(CASE WHEN ppm.month_num = 8 THEN tmu.fullname END) as month_8_pic,
                    MAX(CASE WHEN ppm.month_num = 9 THEN tmu.fullname END) as month_9_pic,
                    MAX(CASE WHEN ppm.month_num = 10 THEN tmu.fullname END) as month_10_pic,
                    MAX(CASE WHEN ppm.month_num = 11 THEN tmu.fullname END) as month_11_pic,
                    MAX(CASE WHEN ppm.month_num = 12 THEN tmu.fullname END) as month_12_pic
                FROM ${table.tb_m_kanbans} tmk
                JOIN ${table.tb_m_zones} tmz ON tmk.zone_id = tmz.zone_id
                JOIN ${table.tb_m_freqs} tmf ON tmk.freq_id = tmf.freq_id
                CROSS JOIN resolved_ids ri
                LEFT JOIN pic_per_month ppm ON ppm.kanban_id = tmk.kanban_id
                LEFT JOIN ${table.tb_m_users} tmu ON tmu.user_id = ppm.pic_id
                WHERE tmz.line_id = ri.line_id
                  AND tmk.group_id = ri.group_id
                  AND tmk.deleted_dt IS NULL
                  AND tmz.zone_nm <> 'OTHERS'
                GROUP BY tmk.kanban_id, tmk.kanban_no, tmz.zone_nm, tmk.area_nm, tmf.freq_nm, tmf.color
                ORDER BY tmk.kanban_no ASC
            `, [parsedYear, line_uuid, group_uuid]);

            const ExcelJS = require('exceljs');
            const path = require('path');
            const workbook = new ExcelJS.Workbook();
            const templatePath = path.join(__dirname, '..', '..', 'assets', 'rotasi.xlsx');
            await workbook.xlsx.readFile(templatePath);

            const groupLower = (group_nm || "").toLowerCase();
            let activeSheet = null;
            let otherSheet = null;
            if (groupLower.includes("red")) {
                activeSheet = workbook.getWorksheet("Red - DC#1") || workbook.worksheets[0];
                otherSheet = workbook.getWorksheet("White - DC#2") || workbook.worksheets[1];
            } else {
                activeSheet = workbook.getWorksheet("White - DC#2") || workbook.worksheets[1];
                otherSheet = workbook.getWorksheet("Red - DC#1") || workbook.worksheets[0];
            }

            if (otherSheet) {
                workbook.removeWorksheet(otherSheet.id);
            }

            if (!activeSheet) {
                return response.failed(res, "Worksheet not found in template");
            }

            // Set Title text (A1:M3 merged) with dynamic Line and Year
            activeSheet.getCell('A1').value = `Schedule Rotasi PIC 4S "${(line_nm || "Line").toUpperCase()}" - Tahun ${parsedYear}`;

            // Set Shift cell (N1:Q3 merged) with dynamic Group name
            activeSheet.getCell('N1').value = `${(group_nm || "Shift").toUpperCase()} - Shift`;

            // Separate items by frequency type to match the template order and styling
            const dailyItems = queryResult.rows.filter(s => (s.freq_nm || "").toLowerCase().includes("day"));
            const weeklyItems = queryResult.rows.filter(s => (s.freq_nm || "").toLowerCase().includes("week"));
            const monthlyItems = queryResult.rows.filter(s => {
                const fn = (s.freq_nm || "").toLowerCase();
                return !fn.includes("day") && !fn.includes("week");
            });

            // Adjust column widths for month columns (Columns F to Q, i.e., 6 to 17) to make sure PIC names are not cut off
            for (let colNum = 6; colNum <= 17; colNum++) {
                const col = activeSheet.getColumn(colNum);
                col.width = 18;
            }

            let offset = 0;
            let runningNo = 1;

            const processSection = (items, startRow, defaultSize) => {
                const actualSize = Math.max(defaultSize, items.length);
                const neededRows = actualSize - defaultSize;
                const sectionStart = startRow + offset;

                // Insert rows if needed
                if (neededRows > 0) {
                    for (let k = 0; k < neededRows; k++) {
                        const insertPos = sectionStart + defaultSize + k;
                        const copyFrom = sectionStart; // copy style from first row of section

                        activeSheet.insertRow(insertPos, []);
                        const sourceRow = activeSheet.getRow(copyFrom);
                        const destRow = activeSheet.getRow(insertPos);
                        destRow.height = sourceRow.height;
                        for (let col = 1; col <= 17; col++) {
                            destRow.getCell(col).style = JSON.parse(JSON.stringify(sourceRow.getCell(col).style || {}));
                        }
                    }
                    offset += neededRows;
                }

                // Fill items
                for (let i = 0; i < actualSize; i++) {
                    const rowIndex = sectionStart + i;
                    const row = activeSheet.getRow(rowIndex);
                    const item = items[i];

                    if (item) {
                        row.getCell(1).value = runningNo++;
                        row.getCell(2).value = item.zone_nm;
                        row.getCell(3).value = item.kanban_no;
                        row.getCell(4).value = item.area_nm;
                        row.getCell(5).value = item.freq_nm;

                        // Month columns
                        for (let m = 1; m <= 12; m++) {
                            row.getCell(5 + m).value = item[`month_${m}_pic`] || "";
                        }
                    } else {
                        // Empty row placeholders
                        row.getCell(1).value = "";
                        row.getCell(2).value = "";
                        row.getCell(3).value = "";
                        row.getCell(4).value = "";
                        row.getCell(5).value = "";
                        for (let m = 1; m <= 12; m++) {
                            row.getCell(5 + m).value = "";
                        }
                    }
                }
            };

            // Predefined row layouts in template:
            // Daily: starts at row 6, default size 5
            // Weekly: starts at row 11, default size 10
            // Monthly: starts at row 21, default size 7
            processSection(dailyItems, 6, 5);
            processSection(weeklyItems, 11, 10);
            processSection(monthlyItems, 21, 7);

            // Write response
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            res.setHeader(
                "Content-Disposition",
                `attachment; filename=Schedule_Rotasi_PIC_4S_${(line_nm || "Line").replace(/\s+/g, "_")}_${parsedYear}.xlsx`
            );

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error(error);
            response.failed(res, "Error to export member rotations to Excel");
        }
    },

    export4sScheduleToExcel: async (req, res) => {
        let client = null;
        try {
            const { main_schedule_id } = req.query;
            if (!main_schedule_id) {
                return response.failed(res, "main_schedule_id is required");
            }

            client = await databasePool.connect();

            // Fetch the main schedule details to get Line, Group, and Month/Year
            const mainScheduleRes = await client.query(
                `SELECT ms.uuid, ms.main_schedule_id, ms.year_num, ms.month_num, l.line_nm, g.group_nm 
                 FROM tb_r_4s_main_schedules ms
                 JOIN tb_m_lines l ON ms.line_id = l.line_id
                 JOIN tb_m_groups g ON ms.group_id = g.group_id
                 WHERE ms.uuid = $1`,
                [main_schedule_id]
            );

            if (mainScheduleRes.rows.length === 0) {
                return response.failed(res, "Main schedule not found");
            }

            const mainScheduleInfo = mainScheduleRes.rows[0];
            const { line_nm, group_nm, year_num, month_num, main_schedule_id: mainScheduleRealId } = mainScheduleInfo;

            // Fetch all sub schedules optimized with their children populated in a single query
            const subSchedules = await subScheduleService.subScheduleRows({
                main_schedule_id: main_schedule_id,
            });

            // Load Excel template
            const ExcelJS = require('exceljs');
            const path = require('path');
            const workbook = new ExcelJS.Workbook();
            const templatePath = path.join(__dirname, '..', '..', 'assets', 'template.xlsx');
            await workbook.xlsx.readFile(templatePath);

            // Determine sheet based on group_nm
            const groupLower = (group_nm || "").toLowerCase();
            let activeSheet = null;
            let otherSheet = null;
            if (groupLower.includes("red")) {
                activeSheet = workbook.getWorksheet("RED") || workbook.worksheets[1];
                otherSheet = workbook.getWorksheet("WHITE") || workbook.worksheets[0];
            } else {
                activeSheet = workbook.getWorksheet("WHITE") || workbook.worksheets[0];
                otherSheet = workbook.getWorksheet("RED") || workbook.worksheets[1];
            }

            // Delete the other sheet so the downloaded file only contains the relevant one
            if (otherSheet) {
                workbook.removeWorksheet(otherSheet.id);
            }

            if (!activeSheet) {
                return response.failed(res, "Worksheet template not found");
            }

            // Set Header metadata
            activeSheet.getCell('A4').value = "LINE : " + (line_nm || "").toUpperCase();

            const monthNames = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
            const monthStr = monthNames[parseInt(month_num) - 1] || "";
            activeSheet.getCell('I4').value = "BULAN : " + monthStr + " " + year_num;

            // === WIPE ALL MERGES IN DATA ROWS (8+) ===
            // ExcelJS shifts merges when insertRow is called, causing "Cannot merge already merged cells" errors.
            // Solution: remove ALL merges in data area upfront, then re-apply only what we need after processing.
            if (activeSheet.model && activeSheet.model.merges) {
                const headerMerges = []; // Keep merges in rows 1-7
                activeSheet.model.merges.forEach(rangeStr => {
                    const match = rangeStr.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
                    if (match) {
                        const startRow = parseInt(match[2]);
                        const endRow = parseInt(match[4]);
                        // Keep only merges that are entirely within header rows (1-7)
                        if (endRow <= 7) {
                            headerMerges.push(rangeStr);
                        }
                    }
                });
                // Wipe all merges and restore only header merges
                activeSheet.model.merges = headerMerges;
                // Also clear the internal _merges map for rows 8+
                if (activeSheet._merges) {
                    const keysToDelete = [];
                    for (const key of Object.keys(activeSheet._merges)) {
                        const merge = activeSheet._merges[key];
                        if (merge && merge.model) {
                            const topRow = merge.model.top || 0;
                            if (topRow >= 8) {
                                keysToDelete.push(key);
                            }
                        }
                    }
                    keysToDelete.forEach(key => delete activeSheet._merges[key]);
                }
            }

            // Group sub schedules by frequency (daily, weekly, monthly)
            // freq_nm values: "1 Day", "2 Day", "1 Week", "2 Week", "6 Week", "1 Month", "2 Month", etc.
            const dailyItems = subSchedules.filter(s => (s.freq_nm || "").toLowerCase().includes("day"));
            const weeklyItems = subSchedules.filter(s => (s.freq_nm || "").toLowerCase().includes("week"));
            const monthlyItems = subSchedules.filter(s => {
                const fn = (s.freq_nm || "").toLowerCase();
                return !fn.includes("day") && !fn.includes("week");
            });

            let offset = 0;
            let runningNo = 0; // Continuous numbering across all sections

            const processSection = (items, startRow, defaultSize, freqLabel) => {
                const actualSize = Math.max(defaultSize, items.length);
                const neededRows = actualSize - defaultSize;
                const sectionStart = startRow + offset;

                // Insert rows if needed
                if (neededRows > 0) {
                    for (let k = 0; k < neededRows; k++) {
                        const insertPos = sectionStart + defaultSize + k;
                        const copyFrom = sectionStart; // always copy style from first row of section

                        activeSheet.insertRow(insertPos, []);
                        const sourceRow = activeSheet.getRow(copyFrom);
                        const destRow = activeSheet.getRow(insertPos);
                        destRow.height = sourceRow.height;
                        for (let col = 1; col <= 45; col++) {
                            destRow.getCell(col).style = JSON.parse(JSON.stringify(sourceRow.getCell(col).style || {}));
                        }
                    }
                    offset += neededRows;
                }

                // Fill items
                for (let i = 0; i < actualSize; i++) {
                    const rowIndex = sectionStart + i;
                    const row = activeSheet.getRow(rowIndex);
                    const item = items[i];

                    if (item) {
                        runningNo++;
                        row.getCell(1).value = runningNo;
                        row.getCell(2).value = item.zone_nm || "";
                        row.getCell(3).value = item.kanban_no || "";
                        row.getCell(4).value = item.area_nm || "";
                        row.getCell(5).value = item.pic_nm || "";

                        // Fill dates
                        if (item.children && item.children.length > 0) {
                            item.children.forEach(child => {
                                const dayNum = child.date_num;
                                if (dayNum >= 1 && dayNum <= 31) {
                                    const colIndex = 8 + dayNum - 1;
                                    const cell = row.getCell(colIndex);

                                    // Match system UI icons:
                                    // PLANNING = empty circle (dark), ACTUAL = check circle (green)
                                    // LEVEL_UP = X circle (orange), PROBLEM = X circle (red), DELAY = empty circle (red)
                                    let symbol = "";
                                    let colorHex = "3C4B64";
                                    if (child.status === "PLANNING") {
                                        symbol = "○";  // empty circle
                                        colorHex = "8A93A2"; // grey
                                    } else if (child.status === "ACTUAL") {
                                        symbol = "✔";  // checkmark
                                        colorHex = "2EB85C"; // green
                                    } else if (child.status === "LEVEL_UP") {
                                        symbol = "⊗";  // circled times (circle with X)
                                        colorHex = "F97316"; // orange
                                    } else if (child.status === "PROBLEM") {
                                        symbol = "⊗";  // circled times (circle with X)
                                        colorHex = "E55353"; // red
                                    } else if (child.status === "DELAY") {
                                        symbol = "○";  // empty circle
                                        colorHex = "E55353"; // red
                                    }

                                    cell.value = symbol;
                                    cell.style = {
                                        ...cell.style,
                                        alignment: { horizontal: 'center', vertical: 'middle' },
                                        font: {
                                            name: 'Arial',
                                            size: 12,
                                            bold: true,
                                            color: { argb: "FF" + colorHex }
                                        }
                                    };
                                }
                            });
                        }
                    } else {
                        // Clear row
                        row.getCell(1).value = "";
                        row.getCell(2).value = "";
                        row.getCell(3).value = "";
                        row.getCell(4).value = "";
                        row.getCell(5).value = "";
                        for (let col = 8; col <= 38; col++) {
                            row.getCell(col).value = "";
                        }
                    }
                }

                // Apply E-F merges for ALL rows in this section (not just inserted ones)
                for (let i = 0; i < actualSize; i++) {
                    const rowIndex = sectionStart + i;
                    try {
                        activeSheet.mergeCells(rowIndex, 5, rowIndex, 6);
                    } catch (e) {
                        // Ignore if already merged (shouldn't happen after wipe)
                    }
                }

                // Merge frequency column G for the entire section
                try {
                    activeSheet.mergeCells(sectionStart, 7, sectionStart + actualSize - 1, 7);
                    activeSheet.getRow(sectionStart).getCell(7).value = freqLabel;
                    activeSheet.getRow(sectionStart).getCell(7).alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
                } catch (e) {
                    console.error("Frequency merge failed:", e);
                }
            };

            processSection(dailyItems, 8, 6, "Daily");
            processSection(weeklyItems, 14, 9, "Weekly");
            processSection(monthlyItems, 23, 8, "Monthly");

            // Re-apply bottom section merges (shifted by offset)
            // Original template: F31:G31 (TL Check), F32:G32 (GL Check), F33:G33 (SH Check)
            const bottomMerges = [
                { startRow: 31, endRow: 31, startCol: 6, endCol: 7 }, // F-G: TL. Check
                { startRow: 32, endRow: 32, startCol: 6, endCol: 7 }, // F-G: GL check
                { startRow: 33, endRow: 33, startCol: 6, endCol: 7 }, // F-G: SH Check
                { startRow: 35, endRow: 42, startCol: 6, endCol: 6 }, // F: signature area
                { startRow: 43, endRow: 47, startCol: 6, endCol: 6 }, // F: signature area
                { startRow: 48, endRow: 53, startCol: 6, endCol: 6 }, // F: signature area
                { startRow: 54, endRow: 63, startCol: 6, endCol: 6 }, // F: signature area
                { startRow: 64, endRow: 71, startCol: 6, endCol: 6 }, // F: signature area
                { startRow: 72, endRow: 78, startCol: 6, endCol: 6 }, // F: signature area
            ];
            for (const m of bottomMerges) {
                try {
                    activeSheet.mergeCells(
                        m.startRow + offset, m.startCol,
                        m.endRow + offset, m.endCol
                    );
                } catch (e) {
                    // Ignore if merge fails (e.g., rows don't exist)
                }
            }

            // Clear and shade invalid day columns (e.g., day 29, 30, 31 in Feb)
            const maxDays = new Date(year_num, month_num, 0).getDate();
            if (maxDays < 31) {
                const startCol = 8 + maxDays;
                for (let col = startCol; col <= 38; col++) {
                    // Clear header cell in Row 6 (since 6 and 7 are merged)
                    activeSheet.getRow(6).getCell(col).value = "";

                    // Style for shaded columns
                    const shadeFill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFEAEAEA' } // light grey
                    };

                    // Apply shading to header rows 6 & 7
                    activeSheet.getRow(6).getCell(col).fill = shadeFill;
                    activeSheet.getRow(7).getCell(col).fill = shadeFill;

                    // Apply shading and clear values for data rows (8 to last data row + offset)
                    const lastDataRow = 30 + offset; // original last data row is 30
                    for (let r = 8; r <= lastDataRow; r++) {
                        const cell = activeSheet.getRow(r).getCell(col);
                        cell.value = "";
                        cell.fill = shadeFill;
                    }
                }
            }

            // Write to response stream
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            res.setHeader(
                "Content-Disposition",
                `attachment; filename=4S_Schedule_${(line_nm || "Line").replace(/\s+/g, "_")}_${monthStr}_${year_num}.xlsx`
            );

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error("export4sScheduleToExcel error:", error);
            response.failed(res, "Error exporting schedule to Excel");
        } finally {
            if (client) client.release();
        }
    }
}

