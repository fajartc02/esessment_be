const router = require("express")()
const {
    getItemCheckKanban4s,
    postItemCheckKanban4s,
    editItemCheckKanban4s,
    deleteItemCheckKanban4s
} = require("../../../controllers/operational/itemCheckKanban4s.controllers")
const auth = require("../../../helpers/auth")

router.get("/get", auth.verifyToken, getItemCheckKanban4s)
router.post("/add", auth.verifyToken, postItemCheckKanban4s)
router.put('/edit/:id', auth.verifyToken, editItemCheckKanban4s)
router.delete('/delete/:id', auth.verifyToken, deleteItemCheckKanban4s)

module.exports = router
