const router = require('express')()


const { graphFindingSTW } = require('../../../controllers/operational/graph.controllers')
const auth = require('../../../helpers/auth')

router.get('/', auth.verifyToken, graphFindingSTW)


module.exports = router