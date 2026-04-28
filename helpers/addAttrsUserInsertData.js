const moment = require('moment')

function attrsUserInsertData(req, data) {
    let containerData = data
    if (data.length) {
        let mapData = data.map(itm => {
            return {
                ...itm,
                created_by: req.user.fullname,
                created_dt: moment().format().split('+')[0].split('T').join(' '),
                changed_by: req.user.fullname,
                changed_dt: moment().format().split('+')[0].split('T').join(' ')
            }
        })
        containerData = mapData
    } else {
        containerData.created_by = req.user.fullname
        containerData.created_dt = moment().format().split('+')[0].split('T').join(' ')
        containerData.changed_by = req.user.fullname
        containerData.changed_dt = moment().format().split('+')[0].split('T').join(' ')
    }
    return containerData
}


module.exports = attrsUserInsertData