const router = require("express")();
const {
  addScheduleObservationV2,
} = require("../../../controllers/v2/operational/observations.controllers");
const auth = require("../../../helpers/auth");

router.post("/schedule", auth.verifyToken, addScheduleObservationV2);

module.exports = router;
