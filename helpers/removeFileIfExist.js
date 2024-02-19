function removeFileIfExist(existPath) {
    const fs = require('fs')
    fs.unlink(existPath, (err) => {
        if (err) throw err;
        console.log(`${existPath} was deleted`);
        return true
    });

}



module.exports = removeFileIfExist