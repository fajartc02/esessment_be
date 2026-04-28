const router = require('express')()
const { getSubCategories } = require('../../../controllers/v2/master/sub_categories.controllers')
const auth = require('../../../helpers/auth')

/**
 * @swagger
 * /api/v2/master/sub-categories:
 *   get:
 *     tags:
 *       - Sub Categories (V2)
 *     summary: Schedule
 *     description: Schedule
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */
router.get('/', auth.verifyToken, getSubCategories)

module.exports = router