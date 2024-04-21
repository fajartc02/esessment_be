const router = require('express')()
const {
    addScheduleObservation,
    getScheduleObservations,
    getSummaryObservations,
    getDetailObservation,
    addCheckObservation,
    getObservationScheduleList,
    deleteScheduleObservation,
    getTodaySchedule
} = require('../../../controllers/operational/observations.controllers')
const auth = require('../../../helpers/auth')
const upload = require('../../../helpers/upload')

router.get('/summary', auth.verifyToken, getSummaryObservations)
router.get('/schedule', auth.verifyToken, getScheduleObservations)

router.get('/schedule/today', auth.verifyToken, getTodaySchedule)

router.get('/schedule/list', auth.verifyToken, getObservationScheduleList)
router.delete('/schedule/list/delete/:id', auth.verifyToken, deleteScheduleObservation)

router.get('/schedule/:id', auth.verifyToken, getDetailObservation)
router.post('/schedule', auth.verifyToken, addScheduleObservation)

// Upload.single didn't used, just only for handle multipart/form-data
router.post('/check', auth.verifyToken, upload.single('attachment'), addCheckObservation)


module.exports = router