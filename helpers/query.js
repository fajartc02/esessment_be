const pg = require("pg");
const { database, databasePool } = require("../config/database");
const logger = require("./logger");

const _defaultCallbackTrans = async (db = databasePool) => { };

const poolQuery = async (raw) => {
  let client;
  try {
    client = await databasePool.connect();
    console.log("raw query", raw);
    const query = await client.query(raw);
    client.release();
    return query;
  } catch (error) {
    throw error;
  } finally {
    if (client) {
      //client.release();
    }
  }
};

const mapWhereCond = (obj) => {
  if (typeof obj !== "object") {
    return null;
  }

  if (Object.keys(obj).length === 0) {
    return null;
  }

  let result = [];

  for (const key in obj) {
    if (obj[key]) {
      if (typeof obj[key] == "string") {
        if (obj[key].toLowerCase().includes("is null")) {
          result.push(`${key} is null`);
        } else if (obj[key].toLowerCase().includes("is not null")) {
          result.push(`${key} is not null`);
        } else if (
          obj[key].toLowerCase().includes("select")
          || obj[key].toLowerCase().includes("now")
          || obj[key].toLowerCase().includes("extract")
        ) {
          if (key === "") {
            result.push(`${obj[key]}`);
          } else {
            result.push(`${key} = ${obj[key]}`);
          }

        } else if (key.toLowerCase().includes("lower")) {
          result.push(`${key} = '${obj[key]}'`);
        } else if (key.toLowerCase().includes("like_")) {
          result.push(`lower(${key.replace("like_", "")}) like '%${obj[key]}%'`);
        } else {
          result.push(`${key} = '${obj[key]}'`);
        }
      } else if (typeof obj[key] == "object") {
        if (obj[key].isDate && obj[key].value) {
          result.push(`${key}::date = ${obj[key].value}`);
        } else if (obj[key].isDateBetween && obj[key].startDate && obj[key].endDate) {
          result.push(`${key}::date between '${obj[key].startDate}' and '${obj[key].endDate}'`);
        }
      } else {
        result.push(`${key} = '${obj[key]}'`);
      }
    } else if (typeof obj[key] === "number" || typeof obj[key] === "boolean") {
      result.push(`${key} = ${obj[key]}`);
    }
  }

  return result.join("\n and ");
};

module.exports = {
  queryGET: async (table, whereCond = false, cols = null) => {
    return new Promise(async (resolve, reject) => {
      let selectedCols = "*";
      if (cols) {
        selectedCols = cols.join(",");
      }
      if (!whereCond) {
        whereCond = "";
      }
      let q = `SELECT ${selectedCols} FROM ${table} ${whereCond}`;
      console.log(q);
      //logger(q)
      await database
        .query(q)
        .then((result) => {
          resolve(result.rows);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },
  queryPOST: async (table, data) => {
    return new Promise(async (resolve, reject) => {
      let containerColumn = [];
      let containerValues = [];
      for (const key in data) {
        containerColumn.push(key);

        let value = data[key];
        if (typeof value === "string" && value.includes("select")) {
          value = `${data[key]}`;
        } else {
          value = `'${data[key]}'`;
        }

        containerValues.push(
          (data[key] && data[key] != "null") || data[key] == false
            ? `${value}`
            : "NULL"
        );
      }
      let q = `INSERT INTO ${table}(${containerColumn.join(
        ","
      )}) VALUES (${containerValues.join(",")}) RETURNING *`;
      console.log(q);
      await database
        .query(q)
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  },
  queryBulkPOST: async (table, data) => {
    return new Promise(async (resolve, reject) => {
      let containerColumn = [];
      let containerValues = [];
      let mapBulkData = await data.map((item) => {
        containerValues = [];
        for (const key in item) {
          if (key != "childs") {
            if (item[key]) {
              console.log();
              if (typeof item[key] == "object") {
                containerValues.push(`'{${item[key].join(",")}}'`);
              } else {
                containerValues.push(`'${item[key]}'`);
              }
            } else {
              containerValues.push(`NULL`);
            }
          }
        }
        return `(${containerValues.join(",")})`;
      });
      for (const key in data[0]) {
        containerColumn.push(key);
      }
      let q = `INSERT INTO ${table} (${containerColumn.join(
        ","
      )}) VALUES ${mapBulkData.join(",")} RETURNING *`;
      console.log(q);
      await database
        .query(q)
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  },
  queryPUT: async (table, data, whereCond = "") => {
    return new Promise(async (resolve, reject) => {
      let containerSetValues = [];
      for (const key in data) {
        if (data[key] == "CURRENT_TIMESTAMP") {
          containerSetValues.push(`${key} = CURRENT_TIMESTAMP`);
        } else if ((data[key] && data[key] != "null" || data[key] == false) || `${data[key]}`.includes("select")) {
          let value = data[key];
          if (typeof value === "string" && value.includes("select")) {
            value = `${data[key]}`;
          } else {
            value = `'${data[key]}'`;
          }

          containerSetValues.push(`${key} = ${value}`);
        }
      }

      let q = `UPDATE ${table} SET ${containerSetValues.join(
        ","
      )} ${whereCond} RETURNING *`;
      console.log(q);
      await database
        .query(q)
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },
  queryDELETE: async (table, whereCond = "") => {
    return new Promise(async (resolve, reject) => {
      let q = `DELETE FROM ${table} ${whereCond}`;
      await database
        .query(q)
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },
  querySoftDELETE: async (table, data, whereCond = "") => {
    return new Promise(async (resolve, reject) => {
      let containerSetValues = [];
      for (const key in data) {
        containerSetValues.push(`${key} = '${data[key]}'`);
      }
      let q = `UPDATE ${table} SET ${containerSetValues.join(
        ","
      )} FROM ${whereCond}`;
      await database
        .query(q)
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },

  queryCustom: async (sql, log = true) => {
    return new Promise(async (resolve, reject) => {
      let q = sql;
      if (log) {
        console.log(q);
      }
      await database
        .query(q)
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },
  queryTransaction: async (callback = _defaultCallbackTrans) => {
    const db = await databasePool.connect();

    const finish = async () => {
      await db.query(`SET session_replication_role = 'origin'`);
      db.release();
    };

    try {
      await db.query(`SET session_replication_role = 'replica'`);
      await db.query("BEGIN");

      const r = await callback(db);
      await db.query("COMMIT");
      await finish();
      return r;
    } catch (error) {
      //console.log('error transaction', error)
      await db.query("ROLLBACK");
      await finish();
      throw error;
    }
  },
  queryGetTransaction: async (dbPool, table, whereCond = "") => {
    return new Promise(async (resolve, reject) => {
      let q = `SELECT * FROM ${table} ${whereCond}`;
      console.log(q);
      //logger(q)
      await dbPool
        .query(q)
        .then((result) => {
          resolve(result.rows);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },
  queryPostTransaction: async (dbPool, table, data) => {
    return new Promise(async (resolve, reject) => {
      let containerColumn = [];
      let containerValues = [];
      for (const key in data) {
        containerColumn.push(key);

        let value = data[key];
        console.log(value, key);
        if (typeof value === "string" && `${value.toLowerCase()}`.includes("select")) {
          value = `${data[key]}`;
        } else {
          value = `'${data[key]}'`;
        }

        containerValues.push(
          (data[key] && data[key] != "null") || data[key] == false ? `${value}` : "NULL"
        );
      }
      let q = `INSERT INTO ${table}(${containerColumn.join(
        ","
      )}) VALUES (${containerValues.join(",")}) RETURNING *`;
      console.log(q);
      //logger(q)
      await dbPool
        .query(q)
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  },
  queryPutTransaction: async (dbPool, table, data, whereCond = "") => {
    return new Promise(async (resolve, reject) => {
      let containerSetValues = [];
      for (const key in data) {
        if (data[key] == "CURRENT_TIMESTAMP") {
          containerSetValues.push(`${key} = CURRENT_TIMESTAMP`);
        } else if ((data[key] && data[key] != "null") || data[key] == false) {
          let value = data[key];
          if (typeof value === "string" && value.includes("select")) {
            value = `${data[key]}`;
          } else {
            value = `'${data[key]}'`;
          }

          containerSetValues.push(`${key} = ${value}`);
        }
      }

      let q = `UPDATE ${table} SET ${containerSetValues.join(
        ","
      )} ${whereCond} RETURNING *`;
      console.log(q);
      await dbPool
        .query(q)
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },
  queryDeleteTransaction: async (dbPool, table, id, col_nm) => {
    return new Promise(async (resolve, reject) => {
      const q = `DELETE FROM ${table} WHERE ${col_nm} = ${id}`;
      console.log(q);

      await dbPool
        .query(q)
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },
  poolQuery,
  mapWhereCond
};
