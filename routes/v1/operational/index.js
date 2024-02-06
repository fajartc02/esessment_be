const router = require('express')()
const observations = require('./observations')
const findingCm = require('./findingCm')

router.use('/observation', observations)
router.use('/findingCm', findingCm)

module.exports = router