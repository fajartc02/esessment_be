const router = require('express')()
const {
    getMaterialTrainings,
    postMaterialTraining,
    putMaterialTraining,
    deleteMaterialTraining
} = require('../../../controllers/master/material_training.controller')
const auth = require('../../../helpers/auth')
const upload = require('../../../helpers/upload')

/**
 * @swagger
 * /api/v1/master/material-training:
 *   get:
 *     tags:
 *       - Material Training
 *     summary: Get Material Trainings
 *     description: Get all material trainings, optionally filtered by category
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category (Safety, Quality, Productivity, Cost, HR)
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */
router.get('/', auth.verifyToken, getMaterialTrainings)

/**
 * @swagger
 * /api/v1/master/material-training:
 *   post:
 *     tags:
 *       - Material Training
 *     summary: Post Material Training
 *     description: Upload a new material training (PDF only)
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */
router.post('/', auth.verifyToken, (req, res, next) => { req.query.dest = 'material_training'; next(); }, upload.single('file'), postMaterialTraining)

/**
 * @swagger
 * /api/v1/master/material-training/{id}:
 *   put:
 *     tags:
 *       - Material Training
 *     summary: Update Material Training
 *     description: Update material training data and optionally replace PDF file
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */
router.put('/:id', auth.verifyToken, (req, res, next) => { req.query.dest = 'material_training'; next(); }, upload.single('file'), putMaterialTraining)

/**
 * @swagger
 * /api/v1/master/material-training/{id}:
 *   delete:
 *     tags:
 *       - Material Training
 *     summary: Delete Material Training (Soft Delete)
 *     description: Soft delete material training by uuid
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */
router.delete('/:id', auth.verifyToken, deleteMaterialTraining)

module.exports = router
