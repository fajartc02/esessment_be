const router = require('express')()

const users = require('./users')

const lines = require('./lines')

const categories = require('./categories')
const factors = require('./factors')
const judgments = require('./judgments')

router.use('/users', users)

router.use('/lines', lines)

router.use('/categories', categories)
router.use('/factors', factors)
router.use('/judgments', judgments)


module.exports = router