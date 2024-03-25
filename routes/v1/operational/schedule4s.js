const router = require("express")()
const {
  get4sSubSchedule,
  get4sMainSchedule,
  get4sSignCheckerBySignCheckerId,
  edi4sSubSchedule,
  editActual4sSubSchedule,
  sign4sSchedule,
  delete4sSubSchedule,
  delete4sMainSchedule
} = require("../../../controllers/operational/schedule4s.controllers")
const auth = require("../../../helpers/auth")

router.get("/main-schedule", auth.verifyToken, get4sMainSchedule)
router.delete("/main-schedule/delete/:id", auth.verifyToken, delete4sMainSchedule)

router.get("/sub-schedule", auth.verifyToken, get4sSubSchedule)
router.get("/sub-schedule/:id", auth.verifyToken, get4sSubSchedule)
router.get('/sub-schedule/sign/:sign_checker_id', auth.verifyToken, get4sSignCheckerBySignCheckerId)
router.put('/sub-schedule/edit/:id', auth.verifyToken, edi4sSubSchedule)
router.put('/sub-schedule/edit/actual/:id', auth.verifyToken, editActual4sSubSchedule)
router.delete("/sub-schedule/delete/:id", auth.verifyToken, delete4sSubSchedule)
router.put('/sub-schedule/sign/:sign_checker_id', auth.verifyToken, sign4sSchedule)



module.exports = router
