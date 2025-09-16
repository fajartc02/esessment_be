const router = require('express')()
const { getFactorsOpts, postFactor, editFactor, deleteFactor } = require('../../../controllers/master/factors.controllers')
const auth = require('../../../helpers/auth')


/**
 * @swagger
 * /api/v1/master/factors:
 *   get:
 *     tags:
 *       - Factors
 *     summary: Get Factors
 *     description: Get Factors
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/factors:
 *   post:
 *     tags:
 *       - Factors
 *     summary: Post Factors
 *     description: Post Factors
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/factors/edit/{id}:
 *   put:
 *     tags:
 *       - Factors
 *     summary: Edit Factors
 *     description: Edit Factors
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/factors/delete/{id}:
 *   delete:
 *     tags:
 *       - Factors
 *     summary: Delete Factors
 *     description: Delete Factors
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put('/edit/:id', auth.verifyToken, editFactor)
router.delete('/delete/:id', auth.verifyToken, deleteFactor)
router.post('/', auth.verifyToken, postFactor)
router.get('/', auth.verifyToken, getFactorsOpts)

module.exports = router