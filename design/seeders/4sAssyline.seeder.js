const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const { uuid } = require('uuidv4');
const { Pool } = require('pg');
const { databasePool } = require('../../config/database');
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

    if (splitPeriodic.length >= 2 && splitPeriodic[1] == 'Month')
    {
        precitionVal = 30 * splitPeriodic[0]
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
const clearRows = async (db) => {
    console.log('clearing start')
    await db.query(`SET session_replication_role = 'replica'`)

    await db.query(`DELETE FROM ${table.tb_m_kanbans} CASCADE`)
    await db.query(`ALTER TABLE ${table.tb_m_kanbans} ALTER COLUMN kanban_id RESTART WITH 1`)

    await db.query(`DELETE FROM ${table.tb_m_zones} CASCADE`)
    await db.query(`ALTER TABLE ${table.tb_m_zones} ALTER COLUMN zone_id RESTART WITH 1`)

    await db.query(`DELETE FROM ${table.tb_m_freqs} CASCADE`)
    await db.query(`ALTER TABLE ${table.tb_m_freqs} ALTER COLUMN freq_id RESTART WITH 1`)

    await db.query(`SET session_replication_role = 'origin'`)
    console.log('clear rows completed')
}

const main = async () => {
    const db = databasePool

    await clearRows(db)

    const assyLineQuery = await databasePool.query(`select * from tb_m_lines where line_nm in ('Main Line') limit 1`)
    const assyLineRow = assyLineQuery.rows[0]

    const json = JSON.parse(await readFile(path.resolve(__dirname, '../json/4sAssyline.json'), "utf8"));
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
                        and zone_nm = '${json[i].Zona}' 
                `
        //console.log('zoneSql', zoneSql);
        const zoneQuery = await databasePool.query(zoneSql)
        let zoneId = null
        if (zoneQuery.rowCount > 0)
        {
            zoneId = zoneQuery.rows[0].zone_id
        }
        else
        {
            await db.query('BEGIN')

            const newZoneSql = `
                    insert into ${table.tb_m_zones} 
                        (uuid, line_id, zone_nm)
                    values 
                        ('${uuid()}', '${assyLineRow.line_id}', '${json[i].Zona}') 
                    returning *
                `
            //console.log('newzonesql', newZoneSql)
            const newMachineQuery = await db.query(newZoneSql)
            zoneId = newMachineQuery.rows[0].zone_id

            await db.query('COMMIT')
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
            await db.query('BEGIN')

            const newFreqSql = `
                    insert into ${table.tb_m_freqs} 
                        (uuid, freq_nm, precition_val)
                    values
                        ('${uuid()}', '${freqNm}', '${precitionVal}')
                    returning *
                `

            const newFreqQuery = await db.query(newFreqSql)
            freqId = newFreqQuery.rows[0].freq_id

            await db.query('COMMIT')
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
        const kanbanQuery = await db.query(kanbanSql)
        if (kanbanQuery.rowCount == 0)
        {
            await db.query('BEGIN')

            await db.query(`
                    insert into ${table.tb_m_kanbans}
                        (uuid, zone_id, freq_id, kanban_no, area_nm)
                    values
                        ('${uuid()}', '${zoneId}', '${freqId}', '${json[i].no_kanban}', '${json[i].Area}')
                `)

            await db.query('COMMIT')
        }
        //#endregion
    }

    await itemCheck4sSeeder(db)
    console.info('Seeder Completed!!!')
}


main().then((r) => process.exit()).catch((e) => process.exit());
//clearRows()
