const router = require("express")();
const {
  editObservation,
  addObservationCheck,
  addFindingObsCheck,
  addVideoObservation,
} = require("../../../controllers/operational/newObservation.controllers");
const {
  addScheduleObservation,
  getScheduleObservations,
  getSummaryObservations,
  getDetailObservation,
  addCheckObservation,
  getObservationScheduleList,
  deleteScheduleObservation,
  getTodaySchedule,
  countTotalSummarySTW,
  editScheduleObservation,
} = require("../../../controllers/operational/observations.controllers");
const auth = require("../../../helpers/auth");
const upload = require("../../../helpers/upload");

router.get("/summary", auth.verifyToken, getSummaryObservations);
router.get("/schedule", auth.verifyToken, getScheduleObservations);
router.put("/schedule/edit/:id", auth.verifyToken, editScheduleObservation);
router.get("/schedule/count", auth.verifyToken, countTotalSummarySTW);
router.get("/schedule/today", auth.verifyToken, getTodaySchedule);

router.get("/schedule/list", auth.verifyToken, getObservationScheduleList);
router.delete(
  "/schedule/list/delete/:id",
  auth.verifyToken,
  deleteScheduleObservation
);

router.get("/schedule/:id", auth.verifyToken, getDetailObservation);
router.post("/schedule", auth.verifyToken, addScheduleObservation);

router.post("/single-check-obs", auth.verifyToken, editObservation);
router.post("/single-check-category", auth.verifyToken, addObservationCheck);
router.post("/single-check-finding", auth.verifyToken, addFindingObsCheck);
router.post(
  "/upload-video/:observation_id",
  auth.verifyToken,
  upload.single("attachment"),
  addVideoObservation
);
// Upload.single didn't used, just only for handle multipart/form-data
router.post(
  "/check",
  auth.verifyToken,
  upload.single("attachment"),
  addCheckObservation
);

module.exports = router;
