const router = require('express')()

const lines = require('./lines')


router.use('/lines', lines)


module.exports = router