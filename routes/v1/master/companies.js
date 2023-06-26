const router = require('express')()
const { getCompanies, postCompany, editCompany, deleteCompany } = require('../../../controllers/master/companies.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editCompany)
router.delete('/delete/:id', auth.verifyToken, deleteCompany)
router.post('/', auth.verifyToken, postCompany)
router.get('/', auth.verifyToken, getCompanies)

module.exports = router