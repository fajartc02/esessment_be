const router = require("express")()
const {
    getOmSubSchedule,
    getOmMainSchedule,
    getOmSignCheckerBySignCheckerId,
    getDetailOmSubSchedule,
    getOmSubScheduleSummaryPaginate,
    ediOmSubSchedule,
    signOmSchedule,
    deleteOmSubSchedule,
    deleteOmMainSchedule
} = require("../../../controllers/operational/scheduleOm.controllers")

const auth = require("../../../helpers/auth")
const findingOm = require("./findingOm")
const graphOm = require("./graphOm")

//#region schedule
router.get("/main-schedule", auth.verifyToken, getOmMainSchedule)
router.delete("/main-schedule/delete/:id", auth.verifyToken, deleteOmMainSchedule)

router.get("/sub-schedule", auth.verifyToken, getOmSubSchedule)
router.get("/sub-schedule/summary", auth.verifyToken, getOmSubScheduleSummaryPaginate)
router.get("/sub-schedule/:id", auth.verifyToken, getDetailOmSubSchedule)
router.get('/sub-schedule/sign/:sign_checker_id', auth.verifyToken, getOmSignCheckerBySignCheckerId)

router.put('/sub-schedule/edit/:id', auth.verifyToken, ediOmSubSchedule)
router.delete("/sub-schedule/delete/:id", auth.verifyToken, deleteOmSubSchedule)
router.put('/sub-schedule/sign/:sign_checker_id', auth.verifyToken, signOmSchedule)
//#endregion

//#region findings
router.use("/finding", findingOm)
//#endregion

//#region graph
router.use("/", graphOm)
//#endregion

module.exports = router
