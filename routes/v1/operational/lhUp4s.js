const router = require("express")();
const {
  getSchedules,
  createSchedule,
  deleteSchedule,
  getTodayLine,
  getFindings,
  postFinding,
  uploadFindingImage,
  uploadCmImage,
  getFindingsGraph,
  updateFinding,
  deleteFinding,
} = require("../../../controllers/operational/lhUp4s.controllers");

const auth = require("../../../helpers/auth");
const upload = require("../../../helpers/upload");

router.get("/schedules", auth.verifyToken, getSchedules);
router.post("/schedules", auth.verifyToken, createSchedule);
router.delete("/schedules/:id", auth.verifyToken, deleteSchedule);
router.get("/today-line", auth.verifyToken, getTodayLine);

router.get("/findings", auth.verifyToken, getFindings);
router.get("/findings/graph", auth.verifyToken, getFindingsGraph);
router.post("/findings", auth.verifyToken, postFinding);
router.put("/findings/:uuid", auth.verifyToken, updateFinding);
router.delete("/findings/:uuid", auth.verifyToken, deleteFinding);
router.post(
  "/findings/upload-finding-img",
  auth.verifyToken,
  upload.single("attachment"),
  uploadFindingImage
);
router.post(
  "/findings/upload-cm-img",
  auth.verifyToken,
  upload.single("cm_image"),
  uploadCmImage
);

module.exports = router;
