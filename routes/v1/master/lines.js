const router = require('express')()
const { getLinesOpts, postLine, editLine, deleteLine } = require('../../../controllers/master/lines.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editLine)
router.delete('/delete/:id', auth.verifyToken, deleteLine)
router.post('/', auth.verifyToken, postLine)
router.get('/', auth.verifyToken, getLinesOpts)

module.exports = router