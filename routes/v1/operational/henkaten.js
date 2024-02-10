const henkatenControllers = require('../../../controllers/operational/henkaten.controllers')
const auth = require('../../../helpers/auth')

const router = require('express')()

router.get('/get', auth.verifyToken, henkatenControllers.getHenkaten)

router.post('/add', auth.verifyToken, henkatenControllers.addHenkaten)


module.exports = router