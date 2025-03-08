const router = require('express')()
const { getCategories, postCategory, editCategory, deleteCategory, getCategoriesV2 } = require('../../../controllers/master/categories.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editCategory)
router.delete('/delete/:id', auth.verifyToken, deleteCategory)
router.post('/', auth.verifyToken, postCategory)
router.get('/', auth.verifyToken, getCategories)
router.get('/categories-v2', auth.verifyToken, getCategoriesV2)

module.exports = router