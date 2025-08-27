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


/**
 * @swagger
 * /api/v1/master/kanbans/get:
 *   get:
 *     tags:
 *       - Kanbans
 *     summary: Get Kanbans
 *     description: Get Kanbans
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/kanbans/add:
 *   post:
 *     tags:
 *       - Kanbans
 *     summary: Post Kanbans
 *     description: Post Kanbans
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/kanbans/edit/{id}:
 *   put:
 *     tags:
 *       - Kanbans
 *     summary: Edit Kanbans
 *     description: Edit Kanbans
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/kanbans/delete/{id}:
 *   delete:
 *     tags:
 *       - Kanbans
 *     summary: Delete Kanbans
 *     description: Delete Kanbans
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/** 
 * @swagger
 * /api/v1/master/kanbans/upload-sop:
 *   post:
 *     tags:
 *       - Kanbans
 *     summary: Upload SOP
 *     description: Upload SOP
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
*/

router.delete("/delete/:id", auth.verifyToken, deleteKanbans)
router.put("/edit/:id", auth.verifyToken, upload.array('kanban_imgs'), editKanbans)
router.post("/add", auth.verifyToken, upload.array('kanban_imgs'), postKanbans)
router.get("/get", auth.verifyToken, getKanbans)

router.post('/upload-sop', auth.verifyToken, upload.single('sop_file'), uploadSopFile);

module.exports = router
