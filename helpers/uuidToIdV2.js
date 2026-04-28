const uuidToIdV2 = async (table, col, uuid, dbConnect) => {
  console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
  let rawId = await dbConnect.query(
    `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
  );
  return rawId.rows[0][col];
};

module.exports = uuidToIdV2;
