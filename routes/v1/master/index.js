const router = require('express')()

const users = require('./users')

const lines = require('./lines')
const machines = require('./machines')
const pos = require('./pos')
const job = require('./job')
const jobType = require('./jobType')

const groups = require('./groups')
const categories = require('./categories')
const factors = require('./factors')
const judgments = require('./judgments')

router.use('/lines', lines)
router.use('/machines', machines)

router.use('/job', job)
router.use('/pos', pos)
router.use('/jobType', jobType)
router.use('/users', users)

router.use('/groups', groups)
router.use('/categories', categories)
router.use('/factors', factors)
router.use('/judgments', judgments)


module.exports = router