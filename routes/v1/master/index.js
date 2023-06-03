const router = require('express')()

const lines = require('./lines')
const categories = require('./categories')


router.use('/lines', lines)
router.use('/categories', categories)


module.exports = router