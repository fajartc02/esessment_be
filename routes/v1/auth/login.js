const router = require('express')()
const { login } = require('../../../controllers/auth/login.controllers')

router.post('/', login)


module.exports = router