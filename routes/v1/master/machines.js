const router = require('express')()
const { getMachines } = require('../../../controllers/master/machines.controllers')
const auth = require('../../../helpers/auth')

router.get('/', auth.verifyToken, getMachines)

module.exports = router