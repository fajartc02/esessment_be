const router = require("express")()
const {
    getOemItemCheckKanbans,
    postOemItemCheck,
    editOemItemCheck,
    deleteOemItemCheck
} = require("../../../controllers/master/itemCheckKanbanOem.controllers")

const auth = require("../../../helpers/auth")

router.put("/edit/:id", auth.verifyToken, editOemItemCheck)
router.delete("/delete/:id", auth.verifyToken, deleteOemItemCheck)
router.post("/add", auth.verifyToken, postOemItemCheck)
router.get("/get", auth.verifyToken, getOemItemCheckKanbans)


module.exports = router
