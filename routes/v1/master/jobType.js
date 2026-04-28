const router = require('express')()
const { getJobType, postJobType, editJobType, deleteJobType } = require('../../../controllers/master/jobType.controllers')
const auth = require('../../../helpers/auth')

/**
 * @swagger
 * /api/v1/master/jobType:
 *   get:
 *     tags:
 *       - JobType
 *     summary: Get JobType
 *     description: Get JobType
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/jobType:
 *   post:
 *     tags:
 *       - JobType
 *     summary: Post JobType
 *     description: Post JobType
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/edit/jobType/{id}:
 *   put:
 *     tags:
 *       - JobType
 *     summary: Put JobType
 *     description: Put JobType
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/delete/jobType/{id}:
 *   delete:
 *     tags:
 *       - JobType
 *     summary: Delete JobType
 *     description: Delete JobType
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put('/edit/:id', auth.verifyToken, editJobType)
router.delete('/delete/:id', auth.verifyToken, deleteJobType)
router.post('/', auth.verifyToken, postJobType)
router.get('/', auth.verifyToken, getJobType)

module.exports = router