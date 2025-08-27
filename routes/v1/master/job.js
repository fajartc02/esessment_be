const router = require('express')()
const { getJob, postJob, editJob, deleteJob, uploadJobSop } = require('../../../controllers/master/job.controllers')
const auth = require('../../../helpers/auth')
const upload = require('../../../helpers/upload')

/**
 * @swagger
 * /api/v1/master/job:
 *   get:
 *     tags:
 *       - Job
 *     summary: Get Job
 *     description: Get Job
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/job:
 *   post:
 *     tags:
 *       - Job
 *     summary: Post Job
 *     description: Post Job
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/job/{id}:
 *   put:
 *     tags:
 *       - Job
 *     summary: Put Job
 *     description: Put Job
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/job/{id}:
 *   delete:
 *     tags:
 *       - Job
 *     summary: Delete Job
 *     description: Delete Job
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/job/upload-sop/{id}:
 *   put:
 *     tags:
 *       - Job
 *     summary: Put Job
 *     description: Put Job
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */


router.put('/upload-sop', auth.verifyToken, upload.single('attachment'), uploadJobSop)

router.put('/:id', auth.verifyToken, upload.single('attachment'), editJob)
router.delete('/:id', auth.verifyToken, deleteJob)
router.get('/', auth.verifyToken, getJob)
router.post('/', auth.verifyToken, upload.single('attachment'), postJob)

module.exports = router