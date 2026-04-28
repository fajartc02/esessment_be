const router = require("express")()
const {
    getShifts,
    postShift,
    editShift,
    deleteShift
} = require("../../../controllers/master/shifts.controllers")
const auth = require("../../../helpers/auth")


/**
 * @swagger
 * /api/v1/master/shifts/get:
 *   get:
 *     tags:
 *       - Shifts
 *     summary: Get Shifts
 *     description: Get Shifts
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/shifts/add:
 *   post:
 *     tags:
 *       - Shifts
 *     summary: Post Shifts
 *     description: Post Shifts
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/shifts/edit/{id}:
 *   put:
 *     tags:
 *       - Shifts
 *     summary: Edit Shifts
 *     description: Edit Shifts
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/shifts/delete/{id}:
 *   delete:
 *     tags:
 *       - Shifts
 *     summary: Delete Shifts
 *     description: Delete Shifts
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put("/edit/:id", auth.verifyToken, editShift)
router.delete("/delete/:id", auth.verifyToken, deleteShift)
router.post("/add", auth.verifyToken, postShift)
router.get("/get", auth.verifyToken, getShifts)

module.exports = router
