const router = require('express')()
const observations = require('./observations')

router.use('/observation', observations)


module.exports = router