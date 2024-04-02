const router = require("express")()
const {
    getSystems,
    postSystem,
    editSystem,
    deleteSystem
} = require("../../../controllers/master/systems.controllers")
const auth = require("../../../helpers/auth")

router.put("/edit/:id", auth.verifyToken, editSystem)
router.delete("/delete/:id", auth.verifyToken, deleteSystem)
router.post("/add", auth.verifyToken, postSystem)
router.get("/get", auth.verifyToken, getSystems)
router.get("/get/:system_type", auth.verifyToken, getSystems)

module.exports = router
