const router = require('express')()
const { getCompanies, postCompany, editCompany, deleteCompany } = require('../../../controllers/master/companies.controllers')
const auth = require('../../../helpers/auth')


/**
 * @swagger
 * /api/v1/master/companies:
 *   get:
 *     tags:
 *       - Companies
 *     summary: Get Companies
 *     description: Get Companies
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/** 
 * @swagger
 * /api/v1/master/companies:
 *   post:
 *     tags:
 *       - Companies
 *     summary: Post Companies
 *     description: Post Companies
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/** 
 * @swagger
 * /api/v1/master/companies/edit/{id}:
 *   put:
 *     tags:
 *       - Companies
 *     summary: Edit Companies
 *     description: Edit Companies
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/** 
 * @swagger
 * /api/v1/master/companies/delete/{id}:
 *   delete:
 *     tags:
 *       - Companies
 *     summary: Delete Companies
 *     description: Delete Companies
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put('/edit/:id', auth.verifyToken, editCompany)
router.delete('/delete/:id', auth.verifyToken, deleteCompany)
router.post('/', auth.verifyToken, postCompany)
router.get('/', auth.verifyToken, getCompanies)

module.exports = router