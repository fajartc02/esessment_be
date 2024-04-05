const router = require("express")()
const {
  get4sSubSchedule,
  get4sMainSchedule,
  get4sSignCheckerBySignCheckerId,
  getDetail4sSubSchedule,
  edi4sSubSchedule,
  
  sign4sSchedule,
  delete4sSubSchedule,
  delete4sMainSchedule
} = require("../../../controllers/operational/schedule4s.controllers")

const auth = require("../../../helpers/auth")
const finding4s = require('./finding4s')
const scheduleItemCheckKanban4s = require('./scheduleItemCheckKanban4s')
const graph4s = require('./graph4s')

//#region schedule
router.get("/main-schedule", auth.verifyToken, get4sMainSchedule)
router.delete("/main-schedule/delete/:id", auth.verifyToken, delete4sMainSchedule)

router.get("/sub-schedule", auth.verifyToken, get4sSubSchedule)
router.get("/sub-schedule/:id", auth.verifyToken, getDetail4sSubSchedule)
router.get('/sub-schedule/sign/:sign_checker_id', auth.verifyToken, get4sSignCheckerBySignCheckerId)

router.put('/sub-schedule/edit/:id', auth.verifyToken, edi4sSubSchedule)
router.delete("/sub-schedule/delete/:id", auth.verifyToken, delete4sSubSchedule)
router.put('/sub-schedule/sign/:sign_checker_id', auth.verifyToken, sign4sSchedule)
//#endregion

//#region findings
router.use("/finding", finding4s)
//#endregion

//#region item-check-kanban
router.use("/schedule-item-check-kanban", scheduleItemCheckKanban4s)
//#endregion

//#region graph
router.use("/", graph4s)
//#endregion

module.exports = router
