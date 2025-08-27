const router = require('express')()
const { getMachines, postMachine, editMachine, deleteMachine } = require('../../../controllers/master/machines.controllers')
const auth = require('../../../helpers/auth')


/**
 * @swagger
 * /api/v1/master/machines:
 *   get:
 *     tags:
 *       - Machines
 *     summary: Get Machines
 *     description: Get Machines
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/machines:
 *   post:
 *     tags:
 *       - Machines
 *     summary: Post Machines
 *     description: Post Machines
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/machines/edit/{id}:
 *   put:
 *     tags:
 *       - Machines
 *     summary: Edit Machines
 *     description: Edit Machines
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/machines/delete/{id}:
 *   delete:
 *     tags:
 *       - Machines
 *     summary: Delete Machines
 *     description: Delete Machines
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put('/edit/:id', auth.verifyToken, editMachine)
router.delete('/delete/:id', auth.verifyToken, deleteMachine)
router.post('/add', auth.verifyToken, postMachine)
router.get('/get', auth.verifyToken, getMachines)

module.exports = router