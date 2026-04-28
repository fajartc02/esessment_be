const router = require('express')()
const { getCategories, postCategory, editCategory, deleteCategory, getCategoriesV2 } = require('../../../controllers/master/categories.controllers')
const auth = require('../../../helpers/auth')


/**
 * @swagger
 * /api/v1/master/categories:
 *   get:
 *     tags:
 *       - Categories
 *     summary: Get Categories
 *     description: Get Categories
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/categories:
 *   post:
 *     tags:
 *       - Categories
 *     summary: Post Categories
 *     description: Post Categories
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/categories/edit/{id}:
 *   put:
 *     tags:
 *       - Categories
 *     summary: Edit Categories
 *     description: Edit Categories
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/categories/delete/{id}:
 *   delete:
 *     tags:
 *       - Categories
 *     summary: Delete Categories
 *     description: Delete Categories
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/categories/categories-v2:
 *   get:
 *     tags:
 *       - Categories
 *     summary: Get Categories V2
 *     description: Get Categories V2
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put('/edit/:id', auth.verifyToken, editCategory)
router.delete('/delete/:id', auth.verifyToken, deleteCategory)
router.post('/', auth.verifyToken, postCategory)
router.get('/', auth.verifyToken, getCategories)
router.get('/categories-v2', auth.verifyToken, getCategoriesV2)

module.exports = router