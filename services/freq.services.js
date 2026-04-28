const {cleanString, freqMapper} = require("../helpers/formatting");
const {bulkToSchema} = require("../helpers/schema");
const {uuid} = require('uuidv4');
const table = require("../config/table");

const query = {
    async findFreqByRaw(db, {period, insertData = null} = {}) {
        try {
            let freq = cleanString(period)
            const {freqNm, precitionVal} = freqMapper(String(freq));
            if (precitionVal >= 7) {
                const a = 1;
                const b = 2;
            }

            const freqSql = `
                    select 
                        * 
                    from 
                        ${table.tb_m_freqs} 
                    where 
                        freq_nm = '${freqNm}'
                        and precition_val = '${precitionVal}'`

            let result = (await db.query(freqSql)).rows;
            if (!result.length && insertData && typeof insertData === "object" && Object.keys(insertData).length) {
                const schema = await bulkToSchema([
                    {
                        ...insertData,
                        uuid: uuid(),
                        freq_nm: freqNm,
                        precition_val: precitionVal
                    }
                ]);

                const sql = `insert into ${table.tb_m_freqs} (${schema.columns}) values ${schema.values} returning *`;
                const query = (await db.query(sql)).rows;
                return query[0];
            }

            return result[0];
        } catch (e) {
            throw e;
        }
    },
};

module.exports = {
    query,
};