const focusThemaControllers = require("../../../controllers/operational/focusThema.controllers");
const auth = require("../../../helpers/auth");

const router = require("express")();

// get
/**
 * @swagger
 * /api/v1/operational/focus-thema/get:
 *   get:
 *     tags:
 *       - Focus Thema
 *     summary: Get Focus Thema
 *     description: Get Focus Thema
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

// add
/**
 * @swagger
 * /api/v1/operational/focus-thema/add:
 *   post:
 *     tags:
 *       - Focus Thema
 *     summary: Post Focus Thema
 *     description: Post Focus Thema
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

// edit
/**
 * @swagger
 * /api/v1/operational/focus-thema/edit/{id}:
 *   put:
 *     tags:
 *       - Focus Thema
 *     summary: Put Focus Thema
 *     description: Put Focus Thema
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

// delete
/**
 * @swagger
 * /api/v1/operational/focus-thema/delete/{id}:
 *   delete:
 *     tags:
 *       - Focus Thema
 *     summary: Delete Focus Thema
 *     description: Delete Focus Thema
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

// score
/**
 * @swagger
 * /api/v1/operational/focus-thema/score/{id}:
 *   put:
 *     tags:
 *       - Focus Thema
 *     summary: Put Focus Thema
 *     description: Put Focus Thema
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.get("/get", auth.verifyToken, focusThemaControllers.getFocusThema);
router.post("/add", auth.verifyToken, focusThemaControllers.addFocusThema);
router.put("/edit/:id", auth.verifyToken, focusThemaControllers.editFocusThema);
router.delete(
  "/delete/:id",
  auth.verifyToken,
  focusThemaControllers.deleteFocusThema
);
router.put(
  "/score/:id",
  auth.verifyToken,
  focusThemaControllers.editScorefocusThema
);

module.exports = router;
