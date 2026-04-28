const router = require('express')()
const sub_categories = require('./sub_categories')

router.use('/sub-categories', sub_categories)

module.exports = router