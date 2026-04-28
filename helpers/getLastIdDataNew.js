const { queryGET } = require("./query");

function getLastIdDataNew(table, columnId, addNum = 1) {
  return `(SELECT COALESCE(MAX(${columnId}), 0) + ${addNum} FROM ${table})`;
  // return await queryGET(table, ` ORDER BY ${columnId} DESC LIMIT 1`)
  //   .then((result) => {
  //     console.log(result);
  //     if (result.length === 0) return 0;
  //     return result[0][columnId];
  //   })
  //   .catch((err) => {
  //     console.log(err);
  //     return err;
  //   });
}

module.exports = getLastIdDataNew;
