const router = require('express')()
const { getJudgmentsOpts } = require('../../../controllers/master/judgments.controllers')
const auth = require('../../../helpers/auth')

router.get('/', auth.verifyToken, getJudgmentsOpts)

module.exports = router