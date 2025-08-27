const router = require("express")()

const { getComments4S, postComments4S } = require("../../../controllers/operational/comments.controllers")
const auth = require("../../../helpers/auth")

/**
 * @swagger
 * /api/v1/operational/comments-4s/get:
 *   get:
 *     tags:
 *       - Comments4S
 *     summary: Comments4S
 *     description: Comments4S
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/comments-4s/add:
 *   post:
 *     tags:
 *       - Comments4S
 *     summary: Post Comments4S
 *     description: Post Comments4S
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.get("/get", auth.verifyToken, getComments4S)
router.post("/add", auth.verifyToken, postComments4S);


module.exports = router
