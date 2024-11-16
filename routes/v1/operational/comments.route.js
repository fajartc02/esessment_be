const router = require("express")()

const { getComments, postComments } = require("../../../controllers/operational/comments.controllers")
const auth = require("../../../helpers/auth")

router.get("/get", auth.verifyToken, getComments)
router.post("/add", auth.verifyToken, postComments);


module.exports = router
