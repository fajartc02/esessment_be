const router = require("express")();
const {
  addScheduleObservationV2,
} = require("../../../controllers/v2/operational/observations.controllers");
const auth = require("../../../helpers/auth");

/**
 * @swagger
 * /api/v2/operational/observation/schedule:
 *   post:
 *     tags:
 *       - Schedule (V2)
 *     summary: Schedule
 *     description: Schedule
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */
router.post("/schedule", auth.verifyToken, addScheduleObservationV2);


module.exports = router;
