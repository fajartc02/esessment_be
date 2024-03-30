const router = require("express")()
const {
    getKanbans,
    postKanbans,
    editKanbans,
    deleteKanbans
} = require("../../../controllers/master/kanban.controllers")

const auth = require("../../../helpers/auth")
const upload = require('../../../helpers/upload')

router.delete("/delete/:id", auth.verifyToken, deleteKanbans)
router.put("/edit/:id", auth.verifyToken, upload.array('kanban_imgs', 4), editKanbans)
router.post("/add", auth.verifyToken, upload.array('kanban_imgs', 4), postKanbans)
router.get("/get", auth.verifyToken, getKanbans)

module.exports = router
