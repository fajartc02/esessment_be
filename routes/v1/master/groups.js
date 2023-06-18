const router = require('express')();
const { getGroups } = require('../../../controllers/master/groups.controllers')
const auth = require('../../../helpers/auth')

router.get('/', auth.verifyToken, getGroups)

module.exports = router