const router = require('express')()
const { getShops, postShop, editShop, deleteShop } = require('../../../controllers/master/shops.controllers')
const auth = require('../../../helpers/auth')

/**
 * @swagger
 * /api/v1/master/shops:
 *   get:
 *     tags:
 *       - Shops
 *     summary: Get Shops
 *     description: Get Shops
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/shops:
 *   post:
 *     tags:
 *       - Shops
 *     summary: Post Shops
 *     description: Post Shops
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/shops/edit/{id}:
 *   put:
 *     tags:
 *       - Shops
 *     summary: Edit Shops
 *     description: Edit Shops
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/shops/delete/{id}:
 *   delete:
 *     tags:
 *       - Shops
 *     summary: Delete Shops
 *     description: Delete Shops
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put('/edit/:id', auth.verifyToken, editShop)
router.delete('/delete/:id', auth.verifyToken, deleteShop)
router.post('/', auth.verifyToken, postShop)
router.get('/', auth.verifyToken, getShops)

module.exports = router