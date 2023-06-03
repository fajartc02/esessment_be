const router = require('express')()
const {
    addScheduleObservation,
    getScheduleObservations,
    getSummaryObservations,
    getDetailObservation
} = require('../../../controllers/operational/observations.controllers')
const auth = require('../../../helpers/auth')

router.get('/summary', auth.verifyToken, getSummaryObservations)
router.get('/schedule', auth.verifyToken, getScheduleObservations)
router.get('/schedule/:id', auth.verifyToken, getDetailObservation)
router.post('/schedule', auth.verifyToken, addScheduleObservation)


module.exports = router