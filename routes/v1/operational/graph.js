const router = require('express')()


const { graphFindingSTW, graphOverallSTW } = require('../../../controllers/operational/graph.controllers')
const auth = require('../../../helpers/auth')

router.get('/overall', auth.verifyToken, graphOverallSTW)
router.get('/', auth.verifyToken, graphFindingSTW)


module.exports = router