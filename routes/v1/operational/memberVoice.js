const memberVoiceControllers = require("../../../controllers/operational/memberVoice.controllers");
const auth = require("../../../helpers/auth");

const router = require("express")();

/**
 * @swagger
 * /api/v1/operational/member-voice/add:
 *   post:
 *     tags:
 *       - Member Voice
 *     summary: Add Member Voice
 *     description: Add Member Voice
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/member-voice/get:
 *   get:
 *     tags:
 *       - Member Voice
 *     summary: Get Member Voice
 *     description: Get Member Voice
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/member-voice/edit/{id}:
 *   put:
 *     tags:
 *       - Member Voice
 *     summary: Edit Member Voice
 *     description: Edit Member Voice
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/member-voice/delete/{id}:
 *   delete:
 *     tags:
 *       - Member Voice
 *     summary: Delete Member Voice
 *     description: Delete Member Voice
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/member-voice/score/{id}:
 *   put:
 *     tags:
 *       - Member Voice
 *     summary: Edit Member Voice
 *     description: Edit Member Voice
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.post("/add", auth.verifyToken, memberVoiceControllers.addMemberVoice);
router.get("/get", auth.verifyToken, memberVoiceControllers.getMemberVoice);
router.put(
  "/edit/:id",
  auth.verifyToken,
  memberVoiceControllers.editMemberVoice
);
router.put(
  "/score/:id",
  auth.verifyToken,
  memberVoiceControllers.editScoreMemberVoice
);
router.delete(
  "/delete/:id",
  auth.verifyToken,
  memberVoiceControllers.deleteMemberVoice
);

module.exports = router;
