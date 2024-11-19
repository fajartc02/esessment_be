const router = require("express")()
const {
    get4sFindingList,
    post4sFinding,
    edit4sFinding,
    delete4sFinding,
    upload4sImageFinding,
    uploadKaizenFile
} = require("../../../controllers/operational/finding4s.controllers")

const auth = require("../../../helpers/auth")
const upload = require('../../../helpers/upload')

router.get("/get", auth.verifyToken, get4sFindingList)

router.post("/add", auth.verifyToken, post4sFinding)
router.post('/upload-image', auth.verifyToken, upload.single('attachment'), upload4sImageFinding);

router.put("/edit/:id", auth.verifyToken, edit4sFinding)
router.delete("/delete/:id", auth.verifyToken, delete4sFinding)

router.post('/upload-kaizen', auth.verifyToken, upload.single('kaizen_file'), uploadKaizenFile);



module.exports = router
