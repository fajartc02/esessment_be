const { database } = require('../config/database')


const uuidToId = async(table, col, uuid) => {
    console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
    let rawId = await database.query(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`)
    return rawId.rows[0][col]
}


module.exports = uuidToId