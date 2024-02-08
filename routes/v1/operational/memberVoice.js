const memberVoiceControllers = require('../../../controllers/operational/memberVoice.controllers')
const auth = require('../../../helpers/auth')

const router = require('express')()

router.post('/add', auth.verifyToken, memberVoiceControllers.addMemberVoice)
router.get('/get', auth.verifyToken, memberVoiceControllers.getMemberVoice)


module.exports = router