const router = require('express')()
const { getMachines, postMachine, editMachine, deleteMachine } = require('../../../controllers/master/machines.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editMachine)
router.delete('/delete/:id', auth.verifyToken, deleteMachine)
router.post('/add', auth.verifyToken, postMachine)
router.get('/get', auth.verifyToken, getMachines)

module.exports = router