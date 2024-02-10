const focusThemaControllers = require('../../../controllers/operational/focusThema.controllers')
const auth = require('../../../helpers/auth')

const router = require('express')()

router.get('/get', auth.verifyToken, focusThemaControllers.getFocusThema)
router.post('/add', auth.verifyToken, focusThemaControllers.addFocusThema)


module.exports = router