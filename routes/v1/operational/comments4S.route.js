const router = require("express")()

const { getComments4S, postComments4S } = require("../../../controllers/operational/comments.controllers")
const auth = require("../../../helpers/auth")

router.get("/get", auth.verifyToken, getComments4S)
router.post("/add", auth.verifyToken, postComments4S);


module.exports = router
