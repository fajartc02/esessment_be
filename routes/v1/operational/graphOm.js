const router = require("express")()
const {
    graphFindingOm,
    graphOverallOm
} = require("../../../controllers/operational/graphOm.controllers")

const auth = require("../../../helpers/auth")
const upload = require('../../../helpers/upload')

router.get("/graph", auth.verifyToken, graphFindingOm)
router.get("/overall", auth.verifyToken, graphOverallOm)

module.exports = router
