const router = require('express')()
const { getUsersOpts } = require('../../../controllers/master/users.controllers')
const auth = require('../../../helpers/auth')

router.get('/opts', auth.verifyToken, getUsersOpts)

module.exports = router