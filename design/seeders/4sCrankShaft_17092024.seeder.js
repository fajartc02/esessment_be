const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const { uuid } = require('uuidv4');
const { database } = require('../../config/database');
const table = require('../../config/table')
const { totalDaysOfYear } = require('../../helpers/date')
const path = require('path');
const { readFile } = require('fs/promises');
const { cleanString } = require('../../helpers/formatting')
const { createNewKanbanSingleLineSchedule } = require("../../services/4s.services")

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
            case 'day':
            case 'daily':
                precitionVal = 1 * splitPeriodic[0]
                freqNm = `${splitPeriodic[0]} Day`
                break;
            case 'week':
            case 'weekly':
                precitionVal = 7 * splitPeriodic[0]
                freqNm = `${splitPeriodic[0]} Week`
                break;
            case 'month':
            case 'monthly':
                precitionVal = 30 * splitPeriodic[0]
                freqNm = `${splitPeriodic[0]} Month`
                break;
            case 'year':
            case 'yearly':
                precitionVal = totalDaysOfYear() * splitPeriodic[0]
                freqNm = `${splitPeriodic[0]} Year`
                break;
        }
    }
    else
    {
        freqNm = splitPeriodic[0].toLowerCase()
        switch (freqNm)
        {
            case 'day':
            case 'daily':
                precitionVal = 1
                freqNm = `1 Day`
                break;
            case 'week':
            case 'weekly':
                precitionVal = 7
                freqNm = `1 Week`
                break;
            case 'month':
            case 'monthly':
                precitionVal = 30
                freqNm = `1 Month`
                break;
            case 'year':
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

const flagCreatedBy = 'SEEDER CrankShaft 17092024'

/**
 * Clears all rows from the specified tables in the database.
 *
 * @param {database} db - The database connection object.
 * @return {Promise<void>} A promise that resolves when all rows have been cleared.
 */
const clearRows = async (db = database) => {
    console.log('clearing start')
    //await db.query(`SET session_replication_role = 'replica'`)

    //#region clear transaction with flag
    {
        await db.query(`DELETE FROM ${table.tb_r_4s_schedule_sign_checkers} WHERE created_by = '${flagCreatedBy}'`)
        const lastTransSignChecker = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_4s_schedule_sign_checkers} ORDER BY sign_checker_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_r_4s_schedule_sign_checkers} ALTER COLUMN sign_checker_id RESTART WITH ${(lastTransSignChecker.rows[0]?.sign_checker_id ?? 0) + 1}`)

        await db.query(`DELETE FROM ${table.tb_r_4s_sub_schedules} WHERE created_by = '${flagCreatedBy}'`)
        const lastTransSubSchedule = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_4s_sub_schedules} ORDER BY sub_schedule_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_r_4s_sub_schedules} ALTER COLUMN sub_schedule_id RESTART WITH ${(lastTransSubSchedule.rows[0]?.sub_schedule_id ?? 0) + 1}`)

        await db.query(`DELETE FROM ${table.tb_r_4s_main_schedules} WHERE created_by = '${flagCreatedBy}'`)
        const lastTransMainSchedule = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_r_4s_main_schedules} ORDER BY main_schedule_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_r_4s_main_schedules} ALTER COLUMN main_schedule_id RESTART WITH ${(lastTransMainSchedule.rows[0]?.main_schedule_id ?? 0) + 1}`)
    }
    //#endregion

    //#region clear master data with flag
    {
        await db.query(`DELETE FROM ${table.tb_m_4s_item_check_kanbans} WHERE created_by = '${flagCreatedBy}'`)
        const lastItemCheck = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_m_4s_item_check_kanbans} ORDER BY item_check_kanban_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_m_4s_item_check_kanbans} ALTER COLUMN item_check_kanban_id RESTART WITH ${(lastItemCheck.rows[0]?.item_check_kanban_id ?? 0) + 1}`)

        await db.query(`DELETE FROM ${table.tb_m_kanbans} WHERE created_by = '${flagCreatedBy}'`)
        const lastKanban = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_m_kanbans} ORDER BY kanban_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_m_kanbans} ALTER COLUMN kanban_id RESTART WITH ${(lastKanban.rows[0]?.kanban_id ?? 0) + 1}`)

        await db.query(`DELETE FROM ${table.tb_m_zones} WHERE created_by = '${flagCreatedBy}'`)
        const lastZone = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_m_zones} ORDER BY zone_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_m_zones} ALTER COLUMN zone_id RESTART WITH ${(lastZone.rows[0]?.zone_id ?? 0) + 1}`)

        await db.query(`DELETE FROM ${table.tb_m_freqs} WHERE created_by = '${flagCreatedBy}'`)
        const lastFreq = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_m_freqs} ORDER BY freq_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_m_freqs} ALTER COLUMN freq_id RESTART WITH ${(lastFreq.rows[0]?.freq_id ?? 0) + 1}`)
    }
    //#endregion

    //await db.query(`SET session_replication_role = 'origin'`)
    console.log('clear rows completed')
}

const main = async () => {
    const db = database
    db.connect((e) => {

    })

    try
    {
        await clearRows(db)

        const lineQuery = await db.query(`select * from tb_m_lines where line_nm in ('Crank Shaft') and deleted_dt is null limit 1`)
        const lineRow = lineQuery.rows[0]

        const json = JSON.parse(await readFile(path.resolve(__dirname, '../json/4sCrankShaft_17092024.json'), "utf8"));
        for (let i = 0; i < json.length; i++)
        {
            //#region zone
            let zoneNm = json[i].Zone
            if (typeof zoneNm === 'string')
            {
                zoneNm = zoneNm.replace('ZONE ', '').replace(/("|')/g, "").trim()
                zoneNm = zoneNm.replace('ZONA ', '')
            }

            if (!zoneNm)
            {
                throw {
                    message: 'zone is empty',
                    json: json[i]
                }
            }

            zoneNm = cleanString(zoneNm)

            const zoneSql = `
                    select 
                        zone_id 
                    from 
                        ${table.tb_m_zones}
                    where 
                        line_id = '${lineRow.line_id}' 
                        and zone_nm = 'Zone ${zoneNm}' 
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
                        ('${uuid()}', '${lineRow.line_id}', 'Zone ${zoneNm}', '${flagCreatedBy}', '${flagCreatedBy}') 
                    returning *
                `
                console.log('newzonesql', newZoneSql)
                const newZoneQuery = await db.query(newZoneSql)
                zoneId = newZoneQuery.rows[0].zone_id

                //await db.query('COMMIT')
            }
            //#endregion

            //#region freq
            if (!json[i].Periode)
            {
                throw {
                    message: 'freq is empty',
                    json: json[i]
                }
            }

            let freq = cleanString(json[i].Periode)
            const { freqNm, precitionVal } = mapFreq(new String(freq))
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
                        ('${uuid()}', '${freqNm}', '${precitionVal}', '${flagCreatedBy}', '${flagCreatedBy}')
                    returning *
                `
                console.log('newFreqSql', newFreqSql);
                const newFreqQuery = await db.query(newFreqSql)
                freqId = newFreqQuery.rows[0].freq_id

                //await db.query('COMMIT')
            }
            //#endregion

            //#region fetch group
            let groupName = json[i].Group.replace(/("|')/g, "").trim()
            if (groupName.toLowerCase() == 'w')
            {
                groupName = 'WHITE'
            }
            else if (groupName.toLowerCase() == 'r')
            {
                groupName = 'RED'

            }
            const groupSql = `select * from ${table.tb_m_groups} where group_nm = '${groupName}'`
            let groupRow = await db.query(groupSql)
            if (groupRow.rowCount > 0)
            {
                groupRow = groupRow.rows[0]
            }
            else
            {
                throw {
                    message: 'group not found ' + groupName,
                    json: json[i]
                }
            }
            //#endregion

            //#region kanban
            if (!json[i]['No Kanban'])
            {
                throw {
                    message: 'No Kanban is empty',
                    json: json[i]
                }
            }

            let noKanban = cleanString(json[i]['No Kanban'])
            if (typeof noKanban === 'string')
            {
                noKanban = json[i]['No Kanban'].replace(/("|')/g, "").trim()
            }

            let area = cleanString(json[i].Area)
            const kanbanSql = `
                select * from ${table.tb_m_kanbans}
                where
                    zone_id = '${zoneId}'
                    and freq_id = '${freqId}'
                    and kanban_no = '${noKanban}'
                    and area_nm = '${area}'`
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
                        (
                            '${uuid()}', 
                            '${zoneId}', 
                            '${freqId}', 
                            '${noKanban}', 
                            '${area}', 
                            '${groupRow.group_id}', 
                            '${flagCreatedBy}', 
                            '${flagCreatedBy}'
                        )
                    returning *`
                console.log('newKanbanSql', newKanbanSql)
                const newKanbanQuery = await db.query(newKanbanSql)
                kanbanId = newKanbanQuery.rows[0].kanban_id
                //await db.query('COMMIT')
            }
            //#endregion

            //#region item check
            let itemCheckNm = cleanString(json[i]['Item Check'])
            if (itemCheckNm)
            {
                itemCheckNm = cleanString(itemCheckNm.replace(/("|')/g, ""))
            }
            else
            {
                itemCheckNm = '(Tidak Ada Nama)'
            }

            let controlPoint = cleanString(json[i]['Control Point'])
            let method = cleanString(json[i]['Metode 4S'])


            let time = json[i]['Time']
            if (typeof time === 'string')
            {
                time = parseInt(time.trim().replace(/[^0-9.]/g, ""))
            }

            if (time && time >= 100)
            {
                time = 30
            }

            const itemCheckSql = `select 
                                    * 
                                from 
                                    ${table.tb_m_4s_item_check_kanbans} 
                                where 
                                    kanban_id = '${kanbanId}' 
                                    and item_check_nm = '${itemCheckNm}'
                                    and control_point = '${controlPoint}'
                                    and method = '${method}'`
            console.log('itemCheckSql', itemCheckSql)

            const itemCheckQuery = await db.query(itemCheckSql)
            if (itemCheckQuery.rowCount == 0)
            {
                //await db.query('BEGIN')

                const newItemCheckSql = `
                    insert into ${table.tb_m_4s_item_check_kanbans}
                        (uuid, kanban_id, item_check_nm, standart_time, method, control_point, created_by, changed_by)
                    values
                        (
                            '${uuid()}', 
                            '${kanbanId}', 
                            ${itemCheckNm ? `'${itemCheckNm}'` : null}, 
                            ${time ? `'${time}'` : '10'}, 
                            ${method ? `'${method}'` : null}, 
                            ${controlPoint ? `'${controlPoint}'` : null},  
                            '${flagCreatedBy}', 
                            '${flagCreatedBy}'
                        )
                    returning *
                `
                console.log('newItemCheckSql', newItemCheckSql);
                await db.query(newItemCheckSql)

                //await db.query('COMMIT')
            }
            //#endregion


            await createNewKanbanSingleLineSchedule(
                db,
                lineRow.line_id,
                groupRow.group_id,
                precitionVal,
                freqId,
                zoneId,
                kanbanId,
                new Date().getMonth() + 1, // current month, date js is - 1 from actual month
                new Date().getFullYear(),
                null,
                flagCreatedBy
            )
        }

        //await itemCheck4sSeeder(db)
        console.info('Seeder Completed!!!')
    }
    catch (error)
    {
        await clearRows()
        console.error(error)
        console.info('Seeder ERROR!!!')
    }
    finally
    {
        db.end((e) => {
            if (e)
            {
                console.log('error end db', e);
            }
        })
    }
}


main()
    .then((r) => process.exit())
    .catch((e) => {
        console.log('error', e);
        process.exit()
    });
//clearRows().then((r) => process.exit()).catch((e) => process.exit())
