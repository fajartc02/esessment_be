const router = require('express')()
const { register } = require('../../../controllers/auth/register.controllers')

router.post('/', register)


module.exports = router