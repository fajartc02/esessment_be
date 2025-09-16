const router = require("express")()
const {
    getItemCheckKanbans,
    postItemCheck,
    editItemCheck,
    deleteItemCheck,
    getHistoryItemCheckKanbans
} = require("../../../controllers/master/itemCheckKanban.controllers")

const auth = require("../../../helpers/auth")
const upload = require('../../../helpers/upload')


/**
 * @swagger
 * /api/v1/master/item-check-kanbans/get:
 *   get:
 *     tags:
 *       - Item Check Kanbans
 *     summary: Get Item Check Kanbans
 *     description: Get Item Check Kanbans
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/item-check-kanbans/add:
 *   post:
 *     tags:
 *       - Item Check Kanbans
 *     summary: Post Item Check Kanbans
 *     description: Post Item Check Kanbans
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/item-check-kanbans/edit/{id}:
 *   put:
 *     tags:
 *       - Item Check Kanbans
 *     summary: Edit Item Check Kanbans
 *     description: Edit Item Check Kanbans
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/item-check-kanbans/delete/{id}:
 *   delete:
 *     tags:
 *       - Item Check Kanbans
 *     summary: Delete Item Check Kanbans
 *     description: Delete Item Check Kanbans
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/item-check-kanbans/get/history/{item_check_kanban_id}:
 *   get:
 *     tags:
 *       - Item Check Kanbans
 *     summary: Get History Item Check Kanbans
 *     description: Get History Item Check Kanbans
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put("/edit/:id", auth.verifyToken, upload.array('ilustration_imgs'), editItemCheck)
router.delete("/delete/:id", auth.verifyToken, deleteItemCheck)
router.post("/add", auth.verifyToken, upload.array('ilustration_imgs'), postItemCheck)
router.get("/get", auth.verifyToken, getItemCheckKanbans)
router.get("/get/history/:item_check_kanban_id", auth.verifyToken, getHistoryItemCheckKanbans);


module.exports = router
