const memberVoiceControllers = require('../../../controllers/operational/memberVoice.controllers')
const auth = require('../../../helpers/auth')

const router = require('express')()

router.post('/add', auth.verifyToken, memberVoiceControllers.addMemberVoice)
router.get('/get', auth.verifyToken, memberVoiceControllers.getMemberVoice)
router.put('/edit/:id', auth.verifyToken, memberVoiceControllers.editMemberVoice)
router.delete('/delete/:id', auth.verifyToken, memberVoiceControllers.deleteMemberVoice)


module.exports = router