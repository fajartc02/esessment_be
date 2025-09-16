const router = require("express")()

const { getComments, postComments } = require("../../../controllers/operational/comments.controllers")
const auth = require("../../../helpers/auth")

/**
 * @swagger
 * /api/v1/operational/comments/get:
 *   get:
 *     tags:
 *       - Comments
 *     summary: Comments
 *     description: Comments
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/comments/add:
 *   post:
 *     tags:
 *       - Comments
 *     summary: Post Comments
 *     description: Post Comments
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.get("/get", auth.verifyToken, getComments)
router.post("/add", auth.verifyToken, postComments);


module.exports = router
