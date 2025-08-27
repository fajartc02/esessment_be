const router = require('express')()
const { getJudgmentsOpts, postJudgment, editJudgment, deleteJudgment } = require('../../../controllers/master/judgments.controllers')
const auth = require('../../../helpers/auth')


/**
 * @swagger
 * /api/v1/master/judgments:
 *   get:
 *     tags:
 *       - Judgments
 *     summary: Get Judgments
 *     description: Get Judgments
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/judgments:
 *   post:
 *     tags:
 *       - Judgments
 *     summary: Post Judgments
 *     description: Post Judgments
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/judgments/edit/{id}:
 *   put:
 *     tags:
 *       - Judgments
 *     summary: Edit Judgments
 *     description: Edit Judgments
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/judgments/delete/{id}:
 *   delete:
 *     tags:
 *       - Judgments
 *     summary: Delete Judgments
 *     description: Delete Judgments
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put('/edit/:id', auth.verifyToken, editJudgment)
router.delete('/delete/:id', auth.verifyToken, deleteJudgment)
router.post('/', auth.verifyToken, postJudgment)
router.get('/', auth.verifyToken, getJudgmentsOpts)

module.exports = router