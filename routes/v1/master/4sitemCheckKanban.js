const router = require("express")()
const {
    getItemCheckKanbans,
    postItemCheck,
    editItemCheck,
    deleteItemCheck
} = require("../../../controllers/master/itemCheckKanban.controllers")

const auth = require("../../../helpers/auth")
const upload = require('../../../helpers/upload')

router.put("/edit/:id", auth.verifyToken, upload.array('ilustration_imgs'), editItemCheck)
router.delete("/delete/:id", auth.verifyToken, deleteItemCheck)
router.post("/add", auth.verifyToken, upload.array('ilustration_imgs'), postItemCheck)
router.get("/get", auth.verifyToken, getItemCheckKanbans)


module.exports = router
