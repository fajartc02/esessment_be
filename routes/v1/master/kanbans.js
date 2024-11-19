const router = require("express")()
const {
    getKanbans,
    postKanbans,
    editKanbans,
    deleteKanbans,
    uploadSopFile
} = require("../../../controllers/master/kanban.controllers")

const auth = require("../../../helpers/auth")
const upload = require('../../../helpers/upload');

router.delete("/delete/:id", auth.verifyToken, deleteKanbans)
router.put("/edit/:id", auth.verifyToken, upload.array('kanban_imgs'), editKanbans)
router.post("/add", auth.verifyToken, upload.array('kanban_imgs'), postKanbans)
router.get("/get", auth.verifyToken, getKanbans)

router.post('/upload-sop', auth.verifyToken, upload.single('sop_file'), uploadSopFile);

module.exports = router
