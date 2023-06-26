const router = require('express')()
const { getCategories, postCategory, editCategory, deleteCategory } = require('../../../controllers/master/categories.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editCategory)
router.delete('/delete/:id', auth.verifyToken, deleteCategory)
router.post('/', auth.verifyToken, postCategory)
router.get('/', auth.verifyToken, getCategories)

module.exports = router