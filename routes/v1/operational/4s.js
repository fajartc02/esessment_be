const router = require('express')()
const {
    get4sSchedules,
    getHoliday,
    get4sPlans,
} = require('../../../controllers/operational/4s.controllers')
const auth = require('../../../helpers/auth')

router.get('/plan', auth.verifyToken, get4sPlans)
router.get('/schedule', auth.verifyToken, get4sSchedules)

module.exports = router