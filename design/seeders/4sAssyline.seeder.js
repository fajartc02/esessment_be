const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const { uuid } = require('uuidv4');
const { Pool } = require('pg');
const { database, databasePool } = require('../../config/database');
const table = require('../../config/table')
const moment = require('moment')
const { queryTransaction } = require('../../helpers/query')
const { bulkToSchema } = require('../../helpers/schema')
const { totalDaysOfYear } = require('../../helpers/date')
const path = require('path');
const { readFile } = require('fs/promises');
//const itemCheck4sSeeder = require('./4sItemCheck.seeder')

console.log('env', {
    env: process.env.NODE_ENV,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false
})

console.log(`Migration Running ...`)

const mapFreq = (period) => {
    const splitPeriodic = period.split(' ')
    let freqNm = 'Day'
    let precitionVal = 1

    if (splitPeriodic.length >= 2)
    {
        switch (splitPeriodic[1].toLowerCase())
        {
            case 'month':
                precitionVal = 30 * splitPeriodic[0]
                break;
            case 'year':
                precitionVal = totalDaysOfYear() * splitPeriodic[0]
                break;
            case 'day':
                precitionVal = 1 * splitPeriodic[0]
                break;
            case 'week':
                precitionVal = 7 * splitPeriodic[0]
                break;
        }

        freqNm = period
    }
    else
    {
        freqNm = splitPeriodic[0].toLowerCase()
        switch (freqNm)
        {
            case 'daily':
                precitionVal = 1
                freqNm = `1 Day`
                break;
            case 'weekly':
                precitionVal = 7
                freqNm = `1 Week`
                break;
            case 'monthly':
                precitionVal = 30
                freqNm = `1 Month`
                break;
            case 'yearly':
                precitionVal = totalDaysOfYear()
                freqNm = `1 Year`
                break;
        }
    }

    return {
        freqNm: freqNm,
        precitionVal: precitionVal
    }
}

/**
 * Clears all rows from the specified tables in the database.
 *
 * @param {databasePool} db - The database connection object.
 * @return {Promise<void>} A promise that resolves when all rows have been cleared.
 */
const clearRows = async (db = databasePool) => {
    console.log('clearing start')
    //await db.query(`SET session_replication_role = 'replica'`)

    await db.query(`DELETE FROM ${table.tb_r_4s_findings} CASCADE`)
    await db.query(`ALTER TABLE ${table.tb_r_4s_findings} ALTER COLUMN finding_id RESTART WITH 1`)

    await db.query(`DELETE FROM ${table.tb_r_4s_schedule_item_check_kanbans} CASCADE`)
    await db.query(`ALTER TABLE ${table.tb_r_4s_schedule_item_check_kanbans} ALTER COLUMN schedule_item_check_kanban_id RESTART WITH 1`)

    await db.query(`DELETE FROM ${table.tb_r_4s_sub_schedules} CASCADE`)
    await db.query(`ALTER TABLE ${table.tb_r_4s_sub_schedules} ALTER COLUMN sub_schedule_id RESTART WITH 1`)

    await db.query(`DELETE FROM ${table.tb_r_4s_schedule_sign_checkers} CASCADE`)
    await db.query(`ALTER TABLE ${table.tb_r_4s_schedule_sign_checkers} ALTER COLUMN sign_checker_id RESTART WITH 1`)

    await db.query(`DELETE FROM ${table.tb_r_4s_main_schedules} CASCADE`)
    await db.query(`ALTER TABLE ${table.tb_r_4s_main_schedules} ALTER COLUMN main_schedule_id RESTART WITH 1`)

    await db.query(`DELETE FROM ${table.tb_m_4s_item_check_kanbans} WHERE created_by = 'SEEDER'`)
    const lastItemCheck = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_m_4s_item_check_kanbans} ORDER BY item_check_kanban_id DESC LIMIT 1`)
    await db.query(`ALTER TABLE ${table.tb_m_4s_item_check_kanbans} ALTER COLUMN item_check_kanban_id RESTART WITH ${(lastItemCheck.rows[0]?.item_check_kanban_id ?? 0) + 1}`)
    /* if (moment(lastItemCheck.rows[0].created_date).format('YYYY-MM-DD') == moment().format('YYYY-MM-DD') || lastItemCheck.rows[0].created_by == 'SEEDER')
    {
        await db.query(`ALTER TABLE ${table.tb_m_4s_item_check_kanbans} ALTER COLUMN item_check_kanban_id RESTART WITH ${lastItemCheck.rows[0].item_check_kanban_id + 1}`)
    } */

    await db.query(`DELETE FROM ${table.tb_m_kanbans} WHERE created_by = 'SEEDER'`)
    const lastKanban = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_m_kanbans} ORDER BY kanban_id DESC LIMIT 1`)
    await db.query(`ALTER TABLE ${table.tb_m_kanbans} ALTER COLUMN kanban_id RESTART WITH ${(lastKanban.rows[0]?.kanban_id ?? 0) + 1}`)
    /* if (moment(lastKanban.rows[0].created_date).format('YYYY-MM-DD') == moment().format('YYYY-MM-DD') || lastKanban.rows[0].created_by == 'SEEDER')
    {
        await db.query(`ALTER TABLE ${table.tb_m_kanbans} ALTER COLUMN kanban_id RESTART WITH ${lastKanban.rows[0].kanban_id + 1}`)
    } */

    await db.query(`DELETE FROM ${table.tb_m_zones} WHERE created_by = 'SEEDER'`)
    const lastZone = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_m_zones} ORDER BY zone_id DESC LIMIT 1`)
    await db.query(`ALTER TABLE ${table.tb_m_zones} ALTER COLUMN zone_id RESTART WITH ${(lastZone.rows[0]?.zone_id ?? 0) + 1}`)
    /* if (moment(lastZone.rows[0].created_date).format('YYYY-MM-DD') == moment().format('YYYY-MM-DD') || lastZone.rows[0].created_by == 'SEEDER')
    {
        await db.query(`ALTER TABLE ${table.tb_m_zones} ALTER COLUMN zone_id RESTART WITH ${lastZone.rows[0].zone_id + 1}`)
    } */

    await db.query(`DELETE FROM ${table.tb_m_freqs} WHERE created_by = 'SEEDER'`)
    const lastFreq = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_m_freqs} ORDER BY freq_id DESC LIMIT 1`)
    await db.query(`ALTER TABLE ${table.tb_m_freqs} ALTER COLUMN freq_id RESTART WITH ${(lastFreq.rows[0]?.freq_id ?? 0) + 1}`)
    /* if (moment(lastFreq.rows[0].created_date).format('YYYY-MM-DD') == moment().format('YYYY-MM-DD') || lastFreq.rows[0].created_by == 'SEEDER')
    {
        await db.query(`ALTER TABLE ${table.tb_m_freqs} ALTER COLUMN freq_id RESTART WITH ${lastFreq.rows[0].freq_id + 1}`)
    } */

    //await db.query(`SET session_replication_role = 'origin'`)
    console.log('clear rows completed')
}

const main = async () => {
    try
    {
        const db = databasePool

        await clearRows(db)

        const assyLineQuery = await db.query(`select * from tb_m_lines where line_nm in ('Main Line') limit 1`)
        const assyLineRow = assyLineQuery.rows[0]

        const json = JSON.parse(await readFile(path.resolve(__dirname, '../json/4sMainLineRed.json'), "utf8"));
        for (let i = 0; i < json.length; i++)
        {
            //#region zone
            const zoneSql = `
                    select 
                        zone_id 
                    from 
                        ${table.tb_m_zones}
                    where 
                        line_id = '${assyLineRow.line_id}' 
                        and zone_nm = 'Zone ${json[i].Zona}' 
                `
            //console.log('zoneSql', zoneSql);
            const zoneQuery = await db.query(zoneSql)
            let zoneId = null
            if (zoneQuery.rowCount > 0)
            {
                zoneId = zoneQuery.rows[0].zone_id
            }
            else
            {
                //await db.query('BEGIN')
                const newZoneSql = `
                    insert into ${table.tb_m_zones} 
                        (uuid, line_id, zone_nm, created_by, changed_by)
                    values 
                        ('${uuid()}', '${assyLineRow.line_id}', 'Zone ${json[i].Zona}', 'SEEDER', 'SEEDER') 
                    returning *
                `
                console.log('newzonesql', newZoneSql)
                const newZoneQuery = await db.query(newZoneSql)
                zoneId = newZoneQuery.rows[0].zone_id

                //await db.query('COMMIT')
            }
            //#endregion

            //#region freq
            const { freqNm, precitionVal } = mapFreq(new String(json[i].Periode))
            const freqSql = `
                    select 
                        * 
                    from 
                        ${table.tb_m_freqs} 
                    where 
                        freq_nm = '${freqNm}'
                        and precition_val = '${precitionVal}'
                `
            const freqQuery = await db.query(freqSql)

            let freqId = null
            if (freqQuery.rowCount > 0)
            {
                freqId = freqQuery.rows[0].freq_id
            }
            else
            {
                //await db.query('BEGIN')

                const newFreqSql = `
                    insert into ${table.tb_m_freqs} 
                        (uuid, freq_nm, precition_val, created_by, changed_by)
                    values
                        ('${uuid()}', '${freqNm}', '${precitionVal}', 'SEEDER', 'SEEDER')
                    returning *
                `
                console.log('newFreqSql', newFreqSql);
                const newFreqQuery = await db.query(newFreqSql)
                freqId = newFreqQuery.rows[0].freq_id

                //await db.query('COMMIT')
            }
            //#endregion

            //#region fetch group
            const groupSql = `select * from ${table.tb_m_groups} where group_nm = '${json[i].Group}'`
            let groupRow = await db.query(groupSql)
            if (groupRow.rowCount > 0)
            {
                groupRow = groupRow.rows[0]
            }
            else
            {
                console.log('====================================');
                console.log('Group Not Found: ', json[i]);
                console.log('====================================');
            }
            //#endregion

            //#region kanban
            const kanbanSql = `
                select * from ${table.tb_m_kanbans}
                where
                    zone_id = '${zoneId}'
                    and freq_id = '${freqId}'
                    and kanban_no = '${json[i].no_kanban}'
                    and area_nm = '${json[i].Area}'
            `
            console.log('kanbanSql', kanbanSql)
            const kanbanQuery = await db.query(kanbanSql)
            let kanbanId = null
            if (kanbanQuery.rowCount > 0)
            {
                kanbanId = kanbanQuery.rows[0].kanban_id
            }
            else
            {
                //await db.query('BEGIN')
                const newKanbanSql = `
                    insert into ${table.tb_m_kanbans}
                        (uuid, zone_id, freq_id, kanban_no, area_nm, group_id, created_by, changed_by)
                    values
                        ('${uuid()}', '${zoneId}', '${freqId}', '${json[i].no_kanban}', '${json[i].Area}', '${groupRow.group_id}', 'SEEDER', 'SEEDER')
                    returning *
                `
                console.log('newKanbanSql', newKanbanSql)
                const newKanbanQuery = await databasePool.query(newKanbanSql)
                kanbanId = newKanbanQuery.rows[0].kanban_id
                //await db.query('COMMIT')
            }
            //#endregion

            //#region item check
            const itemCheckSql = `
            select 
                * 
            from 
                ${table.tb_m_4s_item_check_kanbans} 
            where 
                kanban_id = '${kanbanId}' 
                and item_check_nm = '${json[i]['Item Check Kanban']}'
                and control_point = '${json[i]['Control Point'].trimStart()}'
                and method = '${json[i]['Metode 4S']}'
        `
            console.log('itemCheckSql', itemCheckSql)
            const itemCheckQuery = await db.query(itemCheckSql)
            if (itemCheckQuery.rowCount == 0)
            {
                //await db.query('BEGIN')

                const newItemCheckSql = `
                    insert into ${table.tb_m_4s_item_check_kanbans}
                        (uuid, kanban_id, item_check_nm, standart_time, method, control_point, created_by, changed_by)
                    values
                        ('${uuid()}', '${kanbanId}', '${json[i]['Item Check Kanban']}', '${json[i]['Time']}', '${json[i]['Metode 4S']}', '${json[i]['Control Point'].trimStart()}',  'SEEDER', 'SEEDER')
                    returning *
                `
                console.log('newItemCheckSql', newItemCheckSql);
                await db.query(newItemCheckSql)

                //await db.query('COMMIT')
            }
            //#endregion
        }

        //await itemCheck4sSeeder(db)
        console.info('Seeder Completed!!!')
    } catch (error)
    {
        console.error(error)
        console.info('Seeder ERROR!!!')
    }

}


main().then((r) => process.exit()).catch((e) => process.exit());
//clearRows().then((r) => process.exit()).catch((e) => process.exit())
