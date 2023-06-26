const router = require('express')()
const { getFactorsOpts, postFactor, editFactor, deleteFactor } = require('../../../controllers/master/factors.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editFactor)
router.delete('/delete/:id', auth.verifyToken, deleteFactor)
router.post('/', auth.verifyToken, postFactor)
router.get('/', auth.verifyToken, getFactorsOpts)

module.exports = router