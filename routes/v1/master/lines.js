const router = require('express')()
const { getLinesOpts } = require('../../../controllers/master/lines.controllers')
const auth = require('../../../helpers/auth')

router.get('/opts', auth.verifyToken, getLinesOpts)

module.exports = router