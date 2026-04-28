const table = require("../config/table");
const {cleanString} = require("../helpers/formatting");

const query = {
    async findZoneByRaw(db, {line_id, zoneNm} = {}) {
        try {
            if (typeof zoneNm === 'string') {
                zoneNm = zoneNm.replace('ZONE ', '')
                    .replace(/("|')/g, "").trim();
                zoneNm = zoneNm.replace('ZONA ', '');
                zoneNm = zoneNm.replace('Zone ', '');
            }

            if (!zoneNm) {
                throw 'zone is empty';
            }

            zoneNm = cleanString(zoneNm)

            const zoneSql = `
                    select 
                        zone_id 
                    from 
                        ${table.tb_m_zones}
                    where 
                        line_id = '${line_id}' 
                        and zone_nm = 'Zone ${zoneNm}' 
                `
            //console.log('zoneSql', zoneSql);
            return await db.query(zoneSql);
        } catch (e) {
            throw e;
        }
    }
};

module.exports = {
    query
};