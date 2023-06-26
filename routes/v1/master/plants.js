const router = require('express')()
const { getPlants, postPlant, editPlant, deletePlant } = require('../../../controllers/master/plants.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editPlant)
router.delete('/delete/:id', auth.verifyToken, deletePlant)
router.post('/', auth.verifyToken, postPlant)
router.get('/', auth.verifyToken, getPlants)

module.exports = router