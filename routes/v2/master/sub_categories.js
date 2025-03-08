const router = require('express')()
const { getSubCategories } = require('../../../controllers/v2/master/sub_categories.controllers')
const auth = require('../../../helpers/auth')

router.get('/', auth.verifyToken, getSubCategories)

module.exports = router