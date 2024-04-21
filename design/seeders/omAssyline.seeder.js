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

const currentDate = moment()
const currentYear = currentDate.year()

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
    const splitPeriodic = period.replace(/\s+/g, '').split('')
    let freqNm = 'Day'
    let precitionVal = 1

    if (splitPeriodic.length >= 2)
    {
        freqNm = splitPeriodic[1].toLowerCase()
        switch (freqNm)
        {
            case 'd':
                precitionVal = 1 * splitPeriodic[0]
                freqNm = `${splitPeriodic[0]} Day`
                break;
            case 'w':
                precitionVal = 7 * splitPeriodic[0]
                freqNm = `${splitPeriodic[0]} Week`
                break;
            case 'm':
                precitionVal = 30 * splitPeriodic[0]
                freqNm = `${splitPeriodic[0]} Month`
                break;
            case 'y':
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
            case 'd':
                precitionVal = 1
                freqNm = `1 Day`
                break;
            case 'w':
                precitionVal = 7
                freqNm = `1 Week`
                break;
            case 'm':
                precitionVal = 30
                freqNm = `1 Month`
                break;
            case 'y':
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

const clearRows = async () => {
    console.log('clearing start')
    await queryTransaction(async (db) => {
        await db.query(`SET session_replication_role = 'replica'`)
        const assyLineQuery = await databasePool.query(`select * from tb_m_lines where line_nm in ('Main Line') limit 1`)
        const assyLineRow = assyLineQuery.rows[0]

        const json = JSON.parse(await readFile(path.resolve(__dirname, '../json/omAssyline.json'), "utf8"));
        for (let i = 0; i < json.length; i++)
        {
            //#region machine
            const machineSql = `
                    select 
                        machine_id 
                    from 
                        ${table.tb_m_machines}
                    where 
                        line_id = '${assyLineRow.line_id}' 
                        and machine_nm = '${json[i].Mesin}' 
                    limit 1
                `
            const machineQuery = await databasePool.query(machineSql)
            let machineRow = null
            if (machineQuery.rowCount > 0)
            {
                await db.query(`SET session_replication_role = 'replica'`)
                const deleteMachineSql = `delete from ${table.tb_m_machines} where line_id = '${assyLineRow.line_id}' and machine_nm = '${json[i].Mesin}'`
                await db.query(deleteMachineSql)
                await db.query(`SET session_replication_role = 'origin'`)

                machineRow = machineQuery.rows[0]
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
            let freqRow = null
            if (freqQuery.rowCount > 0)
            {
                await db.query(`SET session_replication_role = 'replica'`)
                const deleteFreqSql = `delete from ${table.tb_m_freqs} where freq_nm = '${freqNm}' and precition_val = '${precitionVal}'`
                db.query(deleteFreqSql, (error, result) => {
                    if (error)
                    {
                        console.log('deleteFreqSql', error);
                    }
                    else
                    {
                        freqRow = freqQuery.rows[0]
                    }
                })
                await db.query(`SET session_replication_role = 'origin'`)
            }
            //#endregion

            //#region item check
            const whereItemCheck =
                ` 
                    machine_id = '${machineRow.machine_id}'
                    and freq_id = '${freqRow.freq_id}'
                    and item_check_nm = '${json[i].Item}'
                    and location_nm = '${json[i].Location}'
                    and method_nm = '${json[i].Methode}'
                    and standart_nm = '${json[i].Standart}'
            `

            const itemCheckExisting = await db.query(
                `
                    select 
                        * 
                    from 
                        ${table.tb_m_om_item_check_kanbans}
                    where
                        ${whereItemCheck}
                `
            )
            if (itemCheckExisting.rowCount > 0)
            {
                await db.query(`delete from ${table.tb_m_om_item_check_kanbans} where ${whereItemCheck} cascade`)
            }
            //#endregion
        }
        await db.query(`SET session_replication_role = 'origin'`)
        console.log('delete and reset count complete')
    })
}

const migrate = async () => {
    await queryTransaction(async (db) => {
        const assyLineQuery = await databasePool.query(`select * from tb_m_lines where line_nm in ('Main Line') limit 1`)
        const assyLineRow = assyLineQuery.rows[0]

        const json = JSON.parse(await readFile(path.resolve(__dirname, '../json/omAssyline.json'), "utf8"));
        for (let i = 0; i < json.length; i++)
        {
            //#region machine
            const machineSql = `
                    select 
                        machine_id 
                    from 
                        ${table.tb_m_machines}
                    where 
                        line_id = '${assyLineRow.line_id}' 
                        and machine_nm = '${json[i].Mesin}' 
                    limit 1
                `
            const machineQuery = await databasePool.query(machineSql)
            if (machineQuery.rowCount > 0)
            {
                await db.query(`SET session_replication_role = 'replica'`)
                const deleteMachineSql = `delete from ${table.tb_m_machines} where line_id = '${assyLineRow.line_id}' and machine_nm = '${json[i].Mesin}'`
                await db.query(deleteMachineSql)
                await db.query(`select setval('tb_m_machines_machine_id_seq', (select max(machine_id) from tb_m_machines))`)
                await db.query(`SET session_replication_role = 'origin'`)
            }

            const lastRowMachineQuery = await db.query(`select * from ${table.tb_m_machines} order by machine_id desc limit 1`)
            const lastRowMachineRow = lastRowMachineQuery.rows[0]

            const newMachineSql = `
                    insert into ${table.tb_m_machines} 
                        (machine_id, uuid, line_id, machine_nm, op_no)
                    values 
                        (${lastRowMachineRow.machine_id + 1},'${uuid()}', '${assyLineRow.line_id}', '${json[i].Mesin}', '-') 
                    returning *
                `
            let newMachineQuery = await db.query(newMachineSql)
            newMachineQuery = newMachineQuery.rows[0]
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
            const maxFreqId = await db.query(`select max(freq_id) from ${table.tb_m_freqs}`)
            if (freqQuery.rowCount > 0)
            {
                await db.query(`SET session_replication_role = 'replica'`)
                const deleteFreqSql = `delete from ${table.tb_m_freqs} where freq_nm = '${freqNm}' and precition_val = '${precitionVal}'`
                await db.query(deleteFreqSql)
                await db.query(`SET session_replication_role = 'origin'`)
            }

            await db.query(`ALTER TABLE ${table.tb_m_freqs} ALTER COLUMN freq_id RESTART WITH ${maxFreqId.rows[0].max + 1}`)
            const newFreqSql = `
                    insert into ${table.tb_m_freqs} 
                        (uuid, freq_nm, precition_val)
                    values
                        ('${uuid()}', '${freqNm}', '${precitionVal}')
                    returning *
                `
            //console.log('newFreqSql', newFreqSql);
            let newFreqQuery = await db.query(newFreqSql)
            newFreqQuery = newFreqQuery.rows[0]
            //#endregion

            //#region item check
            const whereItemCheck =
                ` 
                    machine_id = '${newMachineQuery.machine_id}'
                    and freq_id = '${newFreqQuery.freq_id}'
                    and item_check_nm = '${json[i].Item}'
                    and location_nm = '${json[i].Location}'
                    and method_nm = '${json[i].Methode}'
                    and standart_nm = '${json[i].Standart}'
                `

            const itemCheckExisting = await db.query(
                `
                    select 
                        * 
                    from 
                        ${table.tb_m_om_item_check_kanbans}
                    where
                        ${whereItemCheck}
                `
            )
            if (itemCheckExisting.rowCount > 0)
            {
                await db.query(`delete from ${table.tb_m_om_item_check_kanbans} where ${whereItemCheck} cascade`)
                await db.query(`select setval('tb_m_om_item_check_kanbans_om_item_check_kanban_id_seq', 1)`)
            }

            await db.query(
                `
                    insert into ${table.tb_m_om_item_check_kanbans}
                        (uuid, machine_id, freq_id, item_check_nm, location_nm, method_nm, standart_nm, standart_time)
                    values
                        ('${uuid()}', '${newMachineQuery.machine_id}', '${newFreqQuery.freq_id}', '${json[i].Item}', ${json[i].Location == '' ? null : `'${json[i].Location}'`}, '${json[i].Methode}', '${json[i].Standart}', '${json[i].Duration}')
                `
            )
            //#endregion
        }
        console.info('Seeder Completed!!!')
    }).then((res) => {
        return 0
    }).catch((err) => {
        console.error('err', err)
        return 0
    })
}

migrate()
//clearRows()
