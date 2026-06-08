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
    const splitPeriodic = period.replace(/\s+/g, '').split(' ')
    let precitionVal = 1

    if (splitPeriodic.length >= 2)
    {
        console.log('splitPeriodic', splitPeriodic);
        switch (splitPeriodic[1].toLowerCase())
        {
            case 'month':
                precitionVal = 30 * splitPeriodic[0]
                break;
            case 'year':
                precitionVal = totalDaysOfYear() * splitPeriodic[0]
                break;
            case 'daily':
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
            case 'week':
                precitionVal = 7
                freqNm = `1 Week`
                break;
            case 'month':
                precitionVal = 30
                freqNm = `1 Month`
                break;
            case 'year':
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

        await db.query(`DELETE FROM ${table.tb_r_om_findings} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_r_om_findings} ALTER COLUMN om_finding_id RESTART WITH 1`)

        await db.query(`DELETE FROM ${table.tb_r_om_schedule_sign_checkers} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_r_om_schedule_sign_checkers} ALTER COLUMN om_sign_checker_id RESTART WITH 1`)

        await db.query(`DELETE FROM ${table.tb_r_om_sub_schedules} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_r_om_sub_schedules} ALTER COLUMN om_sub_schedule_id RESTART WITH 1`)

        await db.query(`DELETE FROM ${table.tb_r_om_main_schedules} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_r_om_main_schedules} ALTER COLUMN om_main_schedule_id RESTART WITH 1`)

        await db.query(`DELETE FROM ${table.tb_m_om_item_check_kanbans} WHERE created_by = 'SEEDER LP WHITE 20052024'`)
        const lastItemCheck = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_m_om_item_check_kanbans} ORDER BY om_item_check_kanban_id DESC LIMIT 1`)
        await db.query(`ALTER TABLE ${table.tb_m_om_item_check_kanbans} ALTER COLUMN om_item_check_kanban_id RESTART WITH ${(lastItemCheck.rows[0]?.om_item_check_kanban_id ?? 0) + 1}`)

        await db.query(`DELETE FROM ${table.tb_m_machines} where category_type = 'TPM' and created_by = 'SEEDER LP WHITE 20052024'`)
        //const lastMachine = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_m_machines} ORDER BY machine_id DESC LIMIT 1`)
        //await db.query(`ALTER TABLE ${table.tb_m_machines} ALTER COLUMN machine_id RESTART WITH ${(lastMachine.rows[0]?.machine_id ?? 0) + 1}`)

        await db.query(`SET session_replication_role = 'origin'`)
        console.log('delete and reset count complete')
    })
}

const migrate = async () => {
    await clearRows()

    const db = databasePool
    const lineQuery = await databasePool.query(`select * from tb_m_lines where line_nm in ('Low Pressure') limit 1`)
    const lineRow = lineQuery.rows[0]

    const json = JSON.parse(await readFile(path.resolve(__dirname, '../json/omLowPreassure.json'), "utf8"));
    for (let i = 0; i < json.length; i++)
    {
        //#region machine
        const machineSql = `
                    select 
                        machine_id 
                    from 
                        ${table.tb_m_machines}
                    where 
                        line_id = '${lineRow.line_id}' 
                        and machine_nm = '${json[i].Mesin}' 
                        and category_type = 'TPM'
                    limit 1
                `
        console.log('machineSql', machineSql);
        const machineQuery = await databasePool.query(machineSql)
        let machineId = null
        if (machineQuery.rowCount > 0)
        {
            machineId = machineQuery.rows[0].machine_id
        }
        else
        {
            const lastRowMachineQuery = await db.query(`select * from ${table.tb_m_machines} order by machine_id desc limit 1`)
            const lastRowMachineRow = lastRowMachineQuery.rows[0]

            const newMachineSql = `
                    insert into ${table.tb_m_machines} 
                        (machine_id, uuid, line_id, machine_nm, op_no, category_type, created_by, changed_by)
                    values 
                        (${lastRowMachineRow.machine_id + 1},'${uuid()}', '${lineRow.line_id}', '${json[i].Mesin}', '-', 'TPM', 'SEEDER LP WHITE 20052024', 'SEEDER LP WHITE 20052024') 
                    returning *
                `
            console.log('newMachineSql', newMachineSql)
            const newMachineQuery = await db.query(newMachineSql)
            machineId = newMachineQuery.rows[0].machine_id
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
        console.log('freqSql', freqSql);
        const freqQuery = await db.query(freqSql)

        let freqId = null
        if (freqQuery.rowCount > 0)
        {
            freqId = freqQuery.rows[0].freq_id
        }
        else
        {
            const newFreqSql = `
                    insert into ${table.tb_m_freqs} 
                        (uuid, freq_nm, precition_val, created_by, changed_by)
                    values
                        ('${uuid()}', '${freqNm}', '${precitionVal}', 'SEEDER LP WHITE 20052024', 'SEEDER LP WHITE 20052024')
                    returning *
                `
            console.log('newFreqSql', newFreqSql)
            const newFreqQuery = await db.query(newFreqSql)
            freqId = newFreqQuery.rows[0].freq_id
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

        //#region item check
        const whereItemCheck =
            ` 
                    machine_id = '${machineId}'
                    and freq_id = '${freqId}'
                    and item_check_nm = '${json[i]['Item Check']}'
                    -- and location_nm = '${json[i].Location}'
                    and method_nm = '${json[i].Methode}'
                    and standart_nm = '${json[i].Standard}'
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
        if (itemCheckExisting.rowCount == 0)
        {
            await db.query(
                `
                    insert into ${table.tb_m_om_item_check_kanbans}
                        (uuid, machine_id, freq_id, item_check_nm, method_nm, standart_nm, standart_time, group_id, created_by, changed_by)
                    values
                        (
                            '${uuid()}', 
                            '${machineId}', 
                            '${freqId}', 
                            '${json[i]['Item Check']}', 
                            -- ${json[i].Location == '' ? null : `'${json[i].Location}'`}, 
                            '${json[i].Methode}', 
                            '${json[i].Standard}', 
                            '${json[i].Duration}', 
                            '${groupRow.group_id}',
                            'SEEDER LP WHITE 20052024',
                            'SEEDER LP WHITE 20052024'
                        )
                `
            )
        }
        //#endregion

        //#region add to tb_m_systems OM_STANDARD
        const omStandardSql = `
            select * from ${table.tb_m_system} where system_type = 'OM_STANDARD' and system_value = '${json[i].Standard}'
        `
        const omStandardQuery = await db.query(omStandardSql)
        if (omStandardQuery.rowCount == 0)
        {
            const newOmStandardSql = `
                insert into ${table.tb_m_system}
                    (uuid, system_type, system_value, created_by, changed_by)
                values
                    ('${uuid()}', 'OM_STANDARD', '${json[i].Standard}', 'SEEDER LP WHITE 20052024', 'SEEDER LP WHITE 20052024')
            `
            await db.query(newOmStandardSql)
        }
        //#endregion

        //#region add to tb_m_systems OM_METHOD
        const omMethodSql = `
            select * from ${table.tb_m_system} where system_type = 'OM_METHOD' and system_value = '${json[i].Methode}'
        `
        const omMethodQuery = await db.query(omMethodSql)
        if (omMethodQuery.rowCount == 0)
        {
            const newOmMethodSql = `
                insert into ${table.tb_m_system}
                    (uuid, system_type, system_value, created_by, changed_by)
                values
                    ('${uuid()}', 'OM_METHOD', '${json[i].Methode}', 'SEEDER LP WHITE 20052024', 'SEEDER LP WHITE 20052024')
            `
            await db.query(newOmMethodSql)
        }
        //#endregion

    }
    console.info('Seeder Completed!!!')
}

migrate()
/* clearRows().then(() => 0).catch((e) => {
    console.log('====================================');
    console.log('clear rows failed', e);
    console.log('====================================');
    return 0
})
 */