const router = require('express')()
const { getLinesOpts, postLine, editLine, deleteLine } = require('../../../controllers/master/lines.controllers')
const auth = require('../../../helpers/auth')


/**
 * @swagger
 * /api/v1/master/lines:
 *   get:
 *     tags:
 *       - Lines
 *     summary: Get Lines
 *     description: Get Lines
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/lines:
 *   post:
 *     tags:
 *       - Lines
 *     summary: Post Lines
 *     description: Post Lines
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/lines/edit/{id}:
 *   put:
 *     tags:
 *       - Lines
 *     summary: Edit Lines
 *     description: Edit Lines
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/lines/delete/{id}:
 *   delete:
 *     tags:
 *       - Lines
 *     summary: Delete Lines
 *     description: Delete Lines
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put('/edit/:id', auth.verifyToken, editLine)
router.delete('/delete/:id', auth.verifyToken, deleteLine)
router.post('/', auth.verifyToken, postLine)
router.get('/', auth.verifyToken, getLinesOpts)

module.exports = router