const moment = require('moment')

function attrsUserUpdateData(req, data) {
    let containerData = data
    if (data.length) {
        let mapData = data.map(itm => {
            return {
                ...itm,
                changed_by: req.user.fullname,
                changed_dt: moment().format().split('+')[0].split('T').join(' ')
            }
        })
        containerData = mapData
    } else {
        containerData.changed_by = req.user.fullname
        containerData.changed_dt = moment().format().split('+')[0].split('T').join(' ')
    }
    return containerData
}


module.exports = attrsUserUpdateData