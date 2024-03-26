const router = require("express")()
const {
    getKanbans,
    postKanbans,
    editKanbans,
    deleteKanbans
} = require("../../../controllers/master/kanban.controllers")

const response = require("../../../helpers/response")
const auth = require("../../../helpers/auth")
const upload = require('../../../helpers/upload')

/* const uploadMiddleware = (req, res, next) => {
    const multer = require('multer')
    const upload = require('../../../helpers/upload').array('kanban_imgs', 4);

    upload(req, res, function (err) {
        if (err instanceof multer.MulterError)
        {
            console.log('failed upload kanban imgs', 'File Upload Max. 4')
            console.log('failed upload kanban imgs', err)
            return response.failed(res, err.message)
        } else if (err)
        {
            console.log('failed upload kanban imgs', err)
            return response.failed(res, err)
        } 

        console.log('uploadMiddleware', 'passed')
        next()
    })
} */

router.delete("/delete/:id", auth.verifyToken, deleteKanbans)
// router.put("/edit/:id", auth.verifyToken, uploadMiddleware, editKanbans)
// router.post("/add", auth.verifyToken, uploadMiddleware, postKanbans)

router.put("/edit/:id", auth.verifyToken, upload.array('kanban_imgs', 4), editKanbans)
router.post("/add", auth.verifyToken, upload.array('kanban_imgs', 4), postKanbans)
router.get("/get", auth.verifyToken, getKanbans)

module.exports = router
