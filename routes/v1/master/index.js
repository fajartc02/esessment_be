const router = require('express')()

const companies = require('./companies')
const plants = require('./plants')
const shops = require('./shops')
const lines = require('./lines')
const machines = require('./machines')


router.use('/companies', companies)
router.use('/plants', plants)
router.use('/shops', shops)
router.use('/lines', lines)
router.use('/machines', machines)


module.exports = router