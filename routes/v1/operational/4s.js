const router = require("express")()
const {
  get4sSubSchedule,
  getHoliday,
  get4sMainSchedule,
} = require("../../../controllers/operational/4s.controllers")
const auth = require("../../../helpers/auth")

router.get("/main-schedule", auth.verifyToken, get4sMainSchedule)
router.get("/sub-schedule", auth.verifyToken, get4sSubSchedule)

module.exports = router
