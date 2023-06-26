const router = require('express')();
const { getGroups, postGroup, editGroup, deleteGroup } = require('../../../controllers/master/groups.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editGroup)
router.delete('/delete/:id', auth.verifyToken, deleteGroup)
router.post('/', auth.verifyToken, postGroup)
router.get('/', auth.verifyToken, getGroups)

module.exports = router