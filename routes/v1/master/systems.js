const router = require("express")()
const {
    getSystems,
    postSystem,
    editSystem,
    deleteSystem
} = require("../../../controllers/master/systems.controllers")
const auth = require("../../../helpers/auth")


/**
 * @swagger
 * /api/v1/master/systems/get:
 *   get:
 *     tags:
 *       - Systems
 *     summary: Get Systems
 *     description: Get Systems
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/systems/add:
 *   post:
 *     tags:
 *       - Systems
 *     summary: Post Systems
 *     description: Post Systems
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/systems/edit/{id}:
 *   put:
 *     tags:
 *       - Systems
 *     summary: Edit Systems
 *     description: Edit Systems
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/systems/delete/{id}:
 *   delete:
 *     tags:
 *       - Systems
 *     summary: Delete Systems
 *     description: Delete Systems
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/systems/get/{system_type}:
 *   get:
 *     tags:
 *       - Systems
 *     summary: Get Systems
 *     description: Get Systems
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put("/edit/:id", auth.verifyToken, editSystem)
router.delete("/delete/:id", auth.verifyToken, deleteSystem)
router.post("/add", auth.verifyToken, postSystem)
router.get("/get", auth.verifyToken, getSystems)
router.get("/get/:system_type", auth.verifyToken, getSystems)

module.exports = router
