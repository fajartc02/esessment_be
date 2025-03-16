const uuidToAbnormalityID = async (table, col, uuid, dbConnect, usedId = null) => {
  console.log(`SELECT ${col} FROM ${table} WHERE ${usedId || 'uuid'} = '${uuid}'`);
  let rawId = await dbConnect.query(
    `SELECT ${col} FROM ${table} WHERE ${usedId || 'uuid'} = '${uuid}'`
  );
  console.log(rawId.rows[0][col], 'abnormality_id')
  return rawId.rows[0][col];
};

module.exports = uuidToAbnormalityID;
