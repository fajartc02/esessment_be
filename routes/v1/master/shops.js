const router = require('express')()
const { getShops, postShop, editShop, deleteShop } = require('../../../controllers/master/shops.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editShop)
router.delete('/delete/:id', auth.verifyToken, deleteShop)
router.post('/', auth.verifyToken, postShop)
router.get('/', auth.verifyToken, getShops)

module.exports = router