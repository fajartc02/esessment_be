const router = require('express')()
const observations = require('./observations')
const findingCm = require('./findingCm')
const memberVoice = require('./memberVoice')

router.use('/observation', observations)
router.use('/findingCm', findingCm)
router.use('/member-voice', memberVoice)

module.exports = router