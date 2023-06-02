const { queryGET } = require("./query");

async function getLastIdData(table, columnId) {
    return await queryGET(table, ` ORDER BY ${columnId} DESC LIMIT 1`)
        .then((result) => {
            console.log(result);
            if (result.length === 0) return 0
            return result[0][columnId]
        }).catch((err) => {
            console.log(err);
            return err
        });

}

module.exports = getLastIdData