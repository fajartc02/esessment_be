const uuidToIdNew = async (table, col, uuid, dbConnect) => {
  // console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
  // let rawId = await dbConnect.query(
  //   `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
  // );
  // return rawId.rows[0][col];
  return `(select ${col} from ${table} where uuid = '${uuid}')`;
};

module.exports = uuidToIdNew;
