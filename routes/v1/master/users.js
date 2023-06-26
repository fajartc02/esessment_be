const router = require('express')()
const { getUsersOpts, postUser, editUser, deleteUser } = require('../../../controllers/master/users.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editUser)
router.delete('/delete/:id', auth.verifyToken, deleteUser)
router.post('/', auth.verifyToken, postUser)
router.get('/opts', auth.verifyToken, getUsersOpts)

module.exports = router