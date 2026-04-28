const router = require('express')()


const { graphFindingSTW, graphOverallSTW } = require('../../../controllers/operational/graph.controllers')
const auth = require('../../../helpers/auth')

/**
 * @swagger
 * /api/v1/operational/graph:
 *   get:
 *     tags:
 *       - Graph
 *     summary: Graph
 *     description: Graph
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/operational/graph/overall:
 *   get:
 *     tags:
 *       - Graph
 *     summary: Graph
 *     description: Graph
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */
router.get('/overall', auth.verifyToken, graphOverallSTW)
router.get('/', auth.verifyToken, graphFindingSTW)


module.exports = router