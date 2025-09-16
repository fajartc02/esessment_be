
const router = require("express")();
const {
  editObservation,
  addObservationCheck,
  addFindingObsCheck,
  addVideoObservation,
  addObservationCheckV2,
  updateObservationCheck,
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
const {
  addSign,
  getSign,
  editSign,
} = require("../../../controllers/v2/operational/stwSign.controllers");
const auth = require("../../../helpers/auth");
const upload = require("../../../helpers/upload");

/**
 * @swagger
 * /api/v1/operational/observations/schedule:
 *   get:
 *     tags:
 *       - Observations
 *     summary: Get Observations
 *     description: Get Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/schedule:
 *   post:
 *     tags:
 *       - Observations
 *     summary: Post Observations
 *     description: Post Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/schedule/edit/{id}:
 *   put:
 *     tags:
 *       - Observations
 *     summary: Edit Observations
 *     description: Edit Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/schedule/{id}:
 *   get:
 *     tags:
 *       - Observations
 *     summary: Get Observations
 *     description: Get Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/schedule/list:
 *   get:
 *     tags:
 *       - Observations
 *     summary: Get Observations
 *     description: Get Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/schedule/list/delete/{id}:
 *   delete:
 *     tags:
 *       - Observations
 *     summary: Delete Observations
 *     description: Delete Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/summary:
 *   get:
 *     tags:
 *       - Observations
 *     summary: Get Observations
 *     description: Get Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/sign:
 *   get:
 *     tags:
 *       - Observations
 *     summary: Get Observations
 *     description: Get Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/sign:
 *   post:
 *     tags:
 *       - Observations
 *     summary: Post Observations
 *     description: Post Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/sign/{id}:
 *   put:
 *     tags:
 *       - Observations
 *     summary: Edit Observations
 *     description: Edit Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/single-check-obs:
 *   post:
 *     tags:
 *       - Observations
 *     summary: Post Observations
 *     description: Post Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/single-check-category:
 *   post:
 *     tags:
 *       - Observations
 *     summary: Post Observations
 *     description: Post Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/single-check-category-v2:
 *   post:
 *     tags:
 *       - Observations
 *     summary: Post Observations
 *     description: Post Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/observations/single-check-category/{id}:
 *   put:
 *     tags:
 *       - Observations
 *     summary: Edit Observations
 *     description: Edit Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

//single-check-finding
/**
 * @swagger
 * /api/v1/operational/observations/single-check-finding:
 *   post:
 *     tags:
 *       - Observations
 *     summary: Post Observations
 *     description: Post Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

// upload-video
/**
 * @swagger
 * /api/v1/operational/observations/upload-video/{id}:
 *   post:
 *     tags:
 *       - Observations
 *     summary: Post Observations
 *     description: Post Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

//check
/**
 * @swagger
 * /api/v1/operational/observations/check:
 *   post:
 *     tags:
 *       - Observations
 *     summary: Post Observations
 *     description: Post Observations
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

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

router.post("/sign", auth.verifyToken, addSign);
router.get("/sign", auth.verifyToken, getSign);
router.put("/sign/:id", auth.verifyToken, editSign);

router.post("/single-check-obs", auth.verifyToken, editObservation);
router.post("/single-check-category", auth.verifyToken, addObservationCheck);
router.post(
  "/single-check-category-v2",
  auth.verifyToken,
  addObservationCheckV2
);
router.put(
  "/single-check-category/:obs_result_id",
  auth.verifyToken,
  updateObservationCheck
);
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
