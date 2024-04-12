const router = require("express")()
const {
    getOmFindingList,
    postOmFinding,
    editOmFinding,
    deleteOmFinding,
    uploadOmImageFinding
} = require("../../../controllers/operational/findingOm.controllers")

const auth = require("../../../helpers/auth")
const upload = require('../../../helpers/upload')

router.get("/get", auth.verifyToken, getOmFindingList)

router.post("/add", auth.verifyToken, postOmFinding)
router.post('/upload-image', auth.verifyToken, upload.single('attachment'), uploadOmImageFinding);

router.put("/edit/:id", auth.verifyToken, editOmFinding)
router.delete("/delete/:id", auth.verifyToken, deleteOmFinding)


module.exports = router
