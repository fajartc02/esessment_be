const router = require('express')()
const { getFactorsOpts } = require('../../../controllers/master/factors.controllers')
const auth = require('../../../helpers/auth')

router.get('/', auth.verifyToken, getFactorsOpts)

module.exports = router