const { database } = require("../config/database")

/**
 * e.g.
 * {
 *    table: table.tb_r_4s_main_schedules,
 *    col: "main_schedule_id",
 *    uuid: "7a16d5f8-a32c-4cb7-b819-1862bc973682",
 * },
 * {
 *    table: table.tb_r_4s_sub_schedules,
 *    col: "sub_schedule_id",
 *     uuid: "eee8a3e3-5524-4f34-99fa-c79a5afc394a",
 * },
 *
 * @param {*} cols | {table: "string", col: "string", uuid: "string"}
 * @returns {Promise<JSON>}
 */
const multipleUuidToIds = async (raws = [{}]) => {
  let arrQuery = []
  let arrSelect = []
  for (let i = 0; i < raws.length; i++) {
    let as = null
    if (typeof raws[i].alias != "undefined") {
      as = `as ${raws[i].alias}`
    }

    arrQuery.push(`
        id_${i} as (
            select ${raws[i].col} ${as} from ${raws[i].table} where uuid = '${raws[i].uuid}'
        )
    `)

    arrSelect.push(`id_${i}`)
  }

  const joinedQueries = `
    with ${arrQuery.join(" , ")} select * from ${arrSelect.join(", ")}
  `

  //console.log('multipleuuidtoids', joinedQueries)

  const query = await database.query(joinedQueries)
  return query.rows[0]
}

module.exports = multipleUuidToIds
