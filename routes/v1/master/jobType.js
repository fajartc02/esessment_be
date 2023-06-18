const router = require('express')()
const { getJobType } = require('../../../controllers/master/jobType.controllers')
const auth = require('../../../helpers/auth')

router.get('/', auth.verifyToken, getJobType)

module.exports = router