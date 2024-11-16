const {cleanString, freqMapper} = require("../helpers/formatting");

const query = {
    async findFreqByRaw(db, {period} = {}) {
        try {
            let freq = cleanString(period)
            const {freqNm, precitionVal} = freqMapper(String(freq))
            const freqSql = `
                    select 
                        * 
                    from 
                        ${table.tb_m_freqs} 
                    where 
                        freq_nm = '${freqNm}'
                        and precition_val = '${precitionVal}'`

            return await db.query(freqSql);
        } catch (e) {
            throw e;
        }
    },
};

module.exports = {
    query,
};