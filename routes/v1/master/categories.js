const router = require('express')()
const { getCategories } = require('../../../controllers/master/categories.controllers')
const auth = require('../../../helpers/auth')

router.get('/', auth.verifyToken, getCategories)

module.exports = router