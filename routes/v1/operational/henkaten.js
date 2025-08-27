const henkatenControllers = require("../../../controllers/operational/henkaten.controllers");
const auth = require("../../../helpers/auth");

const router = require("express")();

// get
/**
 * @swagger
 * /api/v1/operational/henkaten/get:
 *   get:
 *     tags:
 *       - Henkaten
 *     summary: Get Henkaten
 *     description: Get Henkaten
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

// add
/**
 * @swagger
 * /api/v1/operational/henkaten/add:
 *   post:
 *     tags:
 *       - Henkaten
 *     summary: Post Henkaten
 *     description: Post Henkaten
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

// delete
/**
 * @swagger
 * /api/v1/operational/henkaten/delete/{id}:
 *   delete:
 *     tags:
 *       - Henkaten
 *     summary: Delete Henkaten
 *     description: Delete Henkaten
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

// edit
/**
 * @swagger
 * /api/v1/operational/henkaten/edit/{id}:
 *   put:
 *     tags:
 *       - Henkaten
 *     summary: Put Henkaten
 *     description: Put Henkaten
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

// score
/**
 * @swagger
 * /api/v1/operational/henkaten/score/{id}:
 *   put:
 *     tags:
 *       - Henkaten
 *     summary: Put Henkaten
 *     description: Put Henkaten
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.get("/get", auth.verifyToken, henkatenControllers.getHenkaten);
router.post("/add", auth.verifyToken, henkatenControllers.addHenkaten);
router.delete(
  "/delete/:id",
  auth.verifyToken,
  henkatenControllers.deleteHenkaten
);
router.put("/edit/:id", auth.verifyToken, henkatenControllers.editHenkaten);
router.put(
  "/score/:id",
  auth.verifyToken,
  henkatenControllers.editScoreHenkanten
);

module.exports = router;
