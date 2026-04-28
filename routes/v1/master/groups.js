const router = require('express')();
const { getGroups, postGroup, editGroup, deleteGroup } = require('../../../controllers/master/groups.controllers')
const auth = require('../../../helpers/auth')


/**
 * @swagger
 * /api/v1/master/groups:
 *   get:
 *     tags:
 *       - Groups
 *     summary: Get Groups
 *     description: Get Groups
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/groups:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Post Groups
 *     description: Post Groups
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/groups/edit/{id}:
 *   put:
 *     tags:
 *       - Groups
 *     summary: Edit Groups
 *     description: Edit Groups
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/groups/delete/{id}:
 *   delete:
 *     tags:
 *       - Groups
 *     summary: Delete Groups
 *     description: Delete Groups
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put('/edit/:id', auth.verifyToken, editGroup)
router.delete('/delete/:id', auth.verifyToken, deleteGroup)
router.post('/', auth.verifyToken, postGroup)
router.get('/', auth.verifyToken, getGroups)

module.exports = router