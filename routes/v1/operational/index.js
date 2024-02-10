const router = require('express')()
const observations = require('./observations')
const findingCm = require('./findingCm')
const memberVoice = require('./memberVoice')
const focusThema = require('./focusThema')
const henkaten = require('./henkaten')
const graph = require('./graph')

router.use('/observation', observations)
router.use('/findingCm', findingCm)
router.use('/member-voice', memberVoice)
router.use('/henkaten', henkaten)
router.use('/focus-thema', focusThema)
router.use('/graph', graph)

module.exports = router