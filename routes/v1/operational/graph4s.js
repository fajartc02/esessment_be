const router = require("express")()
const {
    graphFinding4s,
    graphOverall4s
} = require("../../../controllers/operational/graph4s.controllers")

const auth = require("../../../helpers/auth")
const upload = require('../../../helpers/upload')

router.get("/graph", auth.verifyToken, graphFinding4s)
router.get("/overall", auth.verifyToken, graphOverall4s)

module.exports = router
