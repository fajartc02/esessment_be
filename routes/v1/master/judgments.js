const router = require('express')()
const { getJudgmentsOpts, postJudgment, editJudgment, deleteJudgment } = require('../../../controllers/master/judgments.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editJudgment)
router.delete('/delete/:id', auth.verifyToken, deleteJudgment)
router.post('/', auth.verifyToken, postJudgment)
router.get('/', auth.verifyToken, getJudgmentsOpts)

module.exports = router