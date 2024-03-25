const router = require("express")()
const {
    getKanbans,
    postKanbans,
    editKanbans,
    deleteKanbans
} = require("../../../controllers/master/kanban.controllers")

const response = require("../../../helpers/response")
const auth = require("../../../helpers/auth")


const uploadMiddleware = (req, res, next) => {
    const multer = require('multer')
    const upload = require('../../../helpers/upload').array('kanban_imgs', 4);

    upload(req, res, function (err) {
        if (err instanceof multer.MulterError)
        {
            response.failed(res, 'File Upload Max. 4')
        } else if (err)
        {
            response.failed(res, err)
        } 
        next()
    })
}

router.delete("/delete/:id", auth.verifyToken, deleteKanbans)
router.put("/edit/:id", auth.verifyToken, uploadMiddleware, editKanbans)
router.post("/add", auth.verifyToken, uploadMiddleware, postKanbans)
router.get("/get", auth.verifyToken, getKanbans)

module.exports = router
