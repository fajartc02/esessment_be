const router = require('express')()
const { getPlants, postPlant, editPlant, deletePlant } = require('../../../controllers/master/plants.controllers')
const auth = require('../../../helpers/auth')


/**
 * @swagger
 * /api/v1/master/plants:
 *   get:
 *     tags:
 *       - Plants
 *     summary: Get Plants
 *     description: Get Plants
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/plants:
 *   post:
 *     tags:
 *       - Plants
 *     summary: Post Plants
 *     description: Post Plants
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/plants/edit/{id}:
 *   put:
 *     tags:
 *       - Plants
 *     summary: Edit Plants
 *     description: Edit Plants
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/plants/delete/{id}:
 *   delete:
 *     tags:
 *       - Plants
 *     summary: Delete Plants
 *     description: Delete Plants
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put('/edit/:id', auth.verifyToken, editPlant)
router.delete('/delete/:id', auth.verifyToken, deletePlant)
router.post('/', auth.verifyToken, postPlant)
router.get('/', auth.verifyToken, getPlants)

module.exports = router