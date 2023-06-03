const router = require('express')()
const { addScheduleObservation, getScheduleObservations } = require('../../../controllers/operational/observations.controllers')
const auth = require('../../../helpers/auth')

router.get('/schedule', auth.verifyToken, getScheduleObservations)
router.post('/schedule', auth.verifyToken, addScheduleObservation)


module.exports = router