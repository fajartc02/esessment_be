const router = require('express')()

const users = require('./users')

const companies = require('./companies')
const plants = require('./plants')

const shops = require('./shops')
const lines = require('./lines')
const machines = require('./machines')
const pos = require('./pos')
const job = require('./job')
const jobType = require('./jobType')

const groups = require('./groups')
const categories = require('./categories')
const factors = require('./factors')
const judgments = require('./judgments')
const zones = require('./zones')
const kanbans = require('./kanbans')
const itemCheckKanbans4S = require('./4sitemCheckKanban')
const freqs = require('./freqs')
const shifts = require('./shifts')
const system = require('./systems')
const oemItemCheckKanbans = require('./omItemCheckKanbans')

router.use('/companies', companies)
router.use('/plants', plants)

router.use('/shops', shops)
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
router.use("/zones", zones)
router.use("/kanbans", kanbans)
router.use('/item-check-kanbans', itemCheckKanbans4S)
router.use('/freqs', freqs)
router.use('/shifts', shifts)
router.use('/systems', system)

router.use('/om-item-check-kanbans', oemItemCheckKanbans)


module.exports = router