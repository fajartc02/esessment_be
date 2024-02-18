const { database } = require('../config/database')


const idToUuid = async(table, col, id) => {
    console.log(`SELECT uuid as ${col} FROM ${table} WHERE ${col} = '${id}'`);
    let rawId = await database.query(`SELECT uuid as ${col} FROM ${table} WHERE ${col} = '${id}'`)
    console.log(rawId);
    return rawId.rows[0][col]
}


module.exports = idToUuid