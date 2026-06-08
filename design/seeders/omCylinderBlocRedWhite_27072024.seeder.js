const envFilePath =
  process.env.NODE_ENV.trim() == "production"
    ? "./.env"
    : process.env.NODE_ENV.trim() == "dev"
    ? "./dev.env"
    : "./local.env"
require("dotenv").config({ path: envFilePath })

const { uuid } = require("uuidv4")
const { database } = require("../../config/database")
const table = require("../../config/table")
const moment = require("moment")
const { totalDaysOfYear } = require("../../helpers/date")
const path = require("path")
const { readFile } = require("fs/promises")
const { cleanString } = require("../../helpers/formatting")
const {
  createNewKanbanSingleLineSchedule,
} = require("../../services/om.services")

console.log("env", {
  env: process.env.NODE_ENV,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  host: process.env.DB_HOST,
  ssl: false,
})

console.log(`Migration Running ...`)

const mapFreq = (period) => {
  const splitPeriodic = period.split(" ")
  let freqNm = "Day"
  let precitionVal = 1

  if (splitPeriodic.length >= 2) {
    switch (splitPeriodic[1].toLowerCase()) {
      case "day":
      case "daily":
        precitionVal = 1 * splitPeriodic[0]
        freqNm = `${splitPeriodic[0]} Day`
        break
      case "week":
      case "weekly":
        precitionVal = 7 * splitPeriodic[0]
        freqNm = `${splitPeriodic[0]} Week`
        break
      case "month":
      case "monthly":
        precitionVal = 30 * splitPeriodic[0]
        freqNm = `${splitPeriodic[0]} Month`
        break
      case "year":
      case "yearly":
        precitionVal = totalDaysOfYear() * splitPeriodic[0]
        freqNm = `${splitPeriodic[0]} Year`
        break
    }
  } else {
    freqNm = splitPeriodic[0].toLowerCase()
    switch (freqNm) {
      case "day":
      case "daily":
        precitionVal = 1
        freqNm = `1 Day`
        break
      case "week":
      case "weekly":
        precitionVal = 7
        freqNm = `1 Week`
        break
      case "month":
      case "monthly":
        precitionVal = 30
        freqNm = `1 Month`
        break
      case "year":
      case "yearly":
        precitionVal = totalDaysOfYear()
        freqNm = `1 Year`
        break
    }
  }

  return {
    freqNm: freqNm,
    precitionVal: precitionVal,
  }
}

const flagCreatedBy = "SEEDER CylinderBloc 27072024"

/**
 * Clears all rows from the specified tables in the database.
 *
 * @param {database} db - The database connection object.
 * @return {Promise<void>} A promise that resolves when all rows have been cleared.
 */
const clearRows = async (db = database) => {
  console.log("clearing start")
  //await db.query(`SET session_replication_role = 'replica'`)

  //#region clear transaction with flag
  {
    await db.query(
      `DELETE FROM ${table.tb_r_om_schedule_sign_checkers} WHERE created_by = '${flagCreatedBy}'`
    )
    const lastTransSignChecker = await db.query(
      `SELECT *, date(created_dt) as created_date FROM ${table.tb_r_om_schedule_sign_checkers} ORDER BY om_sign_checker_id DESC LIMIT 1`
    )
    await db.query(
      `ALTER TABLE ${
        table.tb_r_om_schedule_sign_checkers
      } ALTER COLUMN om_sign_checker_id RESTART WITH ${
        (lastTransSignChecker.rows[0]?.om_sign_checker_id ?? 0) + 1
      }`
    )

    await db.query(
      `DELETE FROM ${table.tb_r_om_sub_schedules} WHERE created_by = '${flagCreatedBy}'`
    )
    const lastTransSubSchedule = await db.query(
      `SELECT *, date(created_dt) as created_date FROM ${table.tb_r_om_sub_schedules} ORDER BY om_sub_schedule_id DESC LIMIT 1`
    )
    await db.query(
      `ALTER TABLE ${
        table.tb_r_om_sub_schedules
      } ALTER COLUMN om_sub_schedule_id RESTART WITH ${
        (lastTransSubSchedule.rows[0]?.om_sub_schedule_id ?? 0) + 1
      }`
    )

    await db.query(
      `DELETE FROM ${table.tb_r_om_main_schedules} WHERE created_by = '${flagCreatedBy}'`
    )
    const lastTransMainSchedule = await db.query(
      `SELECT *, date(created_dt) as created_date FROM ${table.tb_r_om_main_schedules} ORDER BY om_main_schedule_id DESC LIMIT 1`
    )
    await db.query(
      `ALTER TABLE ${
        table.tb_r_om_main_schedules
      } ALTER COLUMN om_main_schedule_id RESTART WITH ${
        (lastTransMainSchedule.rows[0]?.om_main_schedule_id ?? 0) + 1
      }`
    )
  }
  //#endregion

  //#region clear master data with flag
  {
    await db.query(
      `DELETE FROM ${table.tb_m_om_item_check_kanbans} WHERE created_by = '${flagCreatedBy}'`
    )
    const lastItemCheck = await db.query(
      `SELECT *, date(created_dt) as created_date FROM ${table.tb_m_om_item_check_kanbans} ORDER BY om_item_check_kanban_id DESC LIMIT 1`
    )
    await db.query(
      `ALTER TABLE ${
        table.tb_m_om_item_check_kanbans
      } ALTER COLUMN om_item_check_kanban_id RESTART WITH ${
        (lastItemCheck.rows[0]?.om_item_check_kanban_id ?? 0) + 1
      }`
    )

    await db.query(
      `DELETE FROM ${table.tb_m_machines} WHERE created_by = '${flagCreatedBy}'`
    )
    // const lastMachine = await db.query(`SELECT *, date(created_dt) as created_date FROM ${table.tb_m_machines} ORDER BY machine_id DESC LIMIT 1`)
    // await db.query(`ALTER TABLE ${table.tb_m_machines} ALTER COLUMN machine_id RESTART WITH ${(lastMachine.rows[0]?.machine_id ?? 0) + 1}`)

    await db.query(
      `DELETE FROM ${table.tb_m_freqs} WHERE created_by = '${flagCreatedBy}'`
    )
    const lastFreq = await db.query(
      `SELECT *, date(created_dt) as created_date FROM ${table.tb_m_freqs} ORDER BY freq_id DESC LIMIT 1`
    )
    await db.query(
      `ALTER TABLE ${table.tb_m_freqs} ALTER COLUMN freq_id RESTART WITH ${
        (lastFreq.rows[0]?.freq_id ?? 0) + 1
      }`
    )

    await db.query(
      `DELETE FROM ${table.tb_m_system} WHERE created_by = '${flagCreatedBy}'`
    )
    const lastSystem = await db.query(
      `SELECT *, date(created_dt) as created_date FROM ${table.tb_m_system} ORDER BY system_id DESC LIMIT 1`
    )
    await db.query(
      `ALTER TABLE ${table.tb_m_system} ALTER COLUMN system_id RESTART WITH ${
        (lastSystem.rows[0]?.system_id ?? 0) + 1
      }`
    )
  }
  //#endregion

  //await db.query(`SET session_replication_role = 'origin'`)
  console.log("clear rows completed")
}

const main = async () => {
  const db = database
  db.connect((e) => {})

  try {
    await clearRows(db)

    const lineQuery = await db.query(
      `select * from tb_m_lines where line_nm in ('Cylinder Block') and line_id = 2 limit 1`
    )
    const lineRow = lineQuery.rows[0]

    const json = JSON.parse(
      await readFile(
        path.resolve(__dirname, "../json/omCylinderBlocRedWhite.json"),
        "utf8"
      )
    )
    for (let i = 0; i < json.length; i++) {
      //#region machine
      if (!json[i].Mesin) {
        throw {
          message: "machine is empty",
          json: json[i],
        }
      }

      const mesin = cleanString(json[i].Mesin)
      const machineSql = `select 
                                    machine_id 
                                from 
                                    ${table.tb_m_machines}
                                where 
                                    line_id = '${lineRow.line_id}' 
                                    and machine_nm = '${mesin}' 
                                    and category_type = 'TPM'
                                limit 1`
      console.log("machineSql", machineSql)
      const machineQuery = await db.query(machineSql)
      let machineId = null
      if (machineQuery.rowCount > 0) {
        machineId = machineQuery.rows[0].machine_id
      } else {
        const lastRowMachineQuery = await db.query(
          `select * from ${table.tb_m_machines} order by machine_id desc limit 1`
        )
        const lastRowMachineRow = lastRowMachineQuery.rows[0]

        const newMachineSql = `insert into ${table.tb_m_machines} 
                        (machine_id, uuid, line_id, machine_nm, op_no, category_type, created_by, changed_by)
                    values 
                        (
                            ${lastRowMachineRow.machine_id + 1},
                            '${uuid()}', 
                            '${lineRow.line_id}', 
                            '${mesin}', 
                            '-', 
                            'TPM', 
                            '${flagCreatedBy}', 
                            '${flagCreatedBy}'
                        ) returning *`
        console.log("newMachineSql", newMachineSql)
        const newMachineQuery = await db.query(newMachineSql)
        machineId = newMachineQuery.rows[0].machine_id
      }
      //#endregion

      //#region freq
      if (!json[i].Periode) {
        throw {
          message: "freq is empty",
          json: json[i],
        }
      }

      const frequency = cleanString(json[i].Periode)
      const { freqNm, precitionVal } = mapFreq(new String(frequency))
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
      if (freqQuery.rowCount > 0) {
        freqId = freqQuery.rows[0].freq_id
      } else {
        //await db.query('BEGIN')

        const newFreqSql = `
                    insert into ${table.tb_m_freqs} 
                        (uuid, freq_nm, precition_val, created_by, changed_by)
                    values
                        ('${uuid()}', '${freqNm}', '${precitionVal}', '${flagCreatedBy}', '${flagCreatedBy}')
                    returning *
                `
        console.log("newFreqSql", newFreqSql)
        const newFreqQuery = await db.query(newFreqSql)
        freqId = newFreqQuery.rows[0].freq_id

        //await db.query('COMMIT')
      }
      //#endregion

      //#region fetch group
      if (!json[i].Shift) {
        throw {
          message: "Shift is empty",
          json: json[i],
        }
      }

      let groupName = cleanString(json[i].Shift)
      if (groupName.toLowerCase() == "w") {
        groupName = "WHITE"
      } else if (groupName.toLowerCase() == "r") {
        groupName = "RED"
      }
      const groupSql = `select * from ${table.tb_m_groups} where group_nm = '${groupName}'`
      let groupRow = await db.query(groupSql)
      if (groupRow.rowCount > 0) {
        groupRow = groupRow.rows[0]
      } else {
        throw {
          message: "Groupname invalid",
          json: json[i],
        }
      }
      //#endregion

      //#region item check
      if (!json[i]["Item Check"]) {
        throw {
          message: "Item Check empty",
          json: json[i],
        }
      }

      const itemCheck = cleanString(json[i]["Item Check"])
      const location = cleanString(json[i].Location)
      const methode = cleanString(json[i].Methode)
      const standart = cleanString(json[i].Standard)

      const whereItemCheck = ` 
                    machine_id = '${machineId}'
                    and freq_id = '${freqId}'
                    and item_check_nm = '${itemCheck}'
                    -- and location_nm = '${location}'
                    and method_nm = '${methode}'
                    and standart_nm = '${standart}'
                `

      const itemCheckExistingSql = `select 
                    * 
                from 
                    ${table.tb_m_om_item_check_kanbans}
                where
                    ${whereItemCheck}`
      console.log("itemCheckExistingSql", itemCheckExistingSql)
      const itemCheckExisting = await db.query(itemCheckExistingSql)

      let itemCheckKanbanId = null
      if (itemCheckExisting.rowCount == 0) {
        const newlyInsertedItemCheckSql = `insert into ${
          table.tb_m_om_item_check_kanbans
        }
                        (uuid, machine_id, freq_id, item_check_nm, method_nm, standart_nm, standart_time, group_id, created_by, changed_by)
                    values
                        (
                            '${uuid()}', 
                            '${machineId}', 
                            '${freqId}', 
                            '${itemCheck}', 
                            -- ${location == "" ? null : `'${location}'`}, 
                            '${methode}', 
                            '${standart}', 
                            '${json[i].Duration}', 
                            '${groupRow.group_id}',
                            '${flagCreatedBy}',
                            '${flagCreatedBy}'
                        ) returning *`
        console.log("newlyInsertedItemCheckSql", newlyInsertedItemCheckSql)
        const newlyInsertedItemCheck = await db.query(newlyInsertedItemCheckSql)

        itemCheckKanbanId =
          newlyInsertedItemCheck.rows[0].om_item_check_kanban_id
      } else {
        itemCheckKanbanId = itemCheckExisting.rows[0].om_item_check_kanban_id
      }
      //#endregion

      //#region add to tb_m_systems OM_STANDARD
      const omStandardSql = `select * from ${table.tb_m_system} where system_type = 'OM_STANDARD' and system_value = '${standart}'`
      console.log("omStandardSql", omStandardSql)
      const omStandardQuery = await db.query(omStandardSql)
      if (omStandardQuery.rowCount == 0) {
        const newOmStandardSql = `insert into ${table.tb_m_system}
                    (uuid, system_type, system_value, created_by, changed_by)
                values
                    ('${uuid()}', 'OM_STANDARD', '${standart}', '${flagCreatedBy}', '${flagCreatedBy}')`
        console.log("newOmStandardSql", newOmStandardSql)
        await db.query(newOmStandardSql)
      }
      //#endregion

      //#region add to tb_m_systems OM_METHOD
      const omMethodSql = `select * from ${table.tb_m_system} where system_type = 'OM_METHOD' and system_value = '${methode}'`
      console.log("omMethodSql", omMethodSql)
      const omMethodQuery = await db.query(omMethodSql)
      if (omMethodQuery.rowCount == 0) {
        const newOmMethodSql = `insert into ${table.tb_m_system}
                    (uuid, system_type, system_value, created_by, changed_by)
                values
                    ('${uuid()}', 'OM_METHOD', '${methode}', '${flagCreatedBy}', '${flagCreatedBy}')`
        console.log("newOmMethodSql", newOmMethodSql)
        await db.query(newOmMethodSql)
      }
      //#endregion

      await createNewKanbanSingleLineSchedule(
        null,
        lineRow.line_id,
        groupRow.group_id,
        precitionVal,
        freqId,
        machineId,
        itemCheckKanbanId,
        new Date().getMonth() + 1, // current month, date js is - 1 from actual month
        new Date().getFullYear(),
        null,
        flagCreatedBy
      )
    }

    console.info("Seeder Completed!!!")
  } catch (error) {
    await clearRows(db)
    console.error("Seeder ERROR!!!", error)
  } finally {
    db.end((e) => {
      if (e) {
        console.log("error end db", e)
      }
    })
  }
}

main()
  .then((r) => process.exit())
  .catch((e) => {
    console.log("error", e)
    process.exit()
  })
//clearRows().then((r) => process.exit()).catch((e) => process.exit())
