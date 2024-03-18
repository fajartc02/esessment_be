const router = require("express")()
const {
    getItemCheckKanbans,
    postItemCheck,
    editItemCheck,
    deleteItemCheck
} = require("../../../controllers/master/itemCheckKanban.controllers")
const auth = require("../../../helpers/auth")

router.put("/edit/:id", auth.verifyToken, editItemCheck)
router.delete("/delete/:id", auth.verifyToken, deleteItemCheck)
router.post("/", auth.verifyToken, postItemCheck)
router.get("/", auth.verifyToken, getItemCheckKanbans)

module.exports = router
