const router = require("express")()
const {
    getOmItemCheckKanbans,
    getOmGroupMachinesPaginate,
    postOmItemCheck,
    editOmItemCheck,
    deleteOmItemCheck
} = require("../../../controllers/master/itemCheckKanbanOm.controllers")

const auth = require("../../../helpers/auth")


/**
 * @swagger
 * /api/v1/master/om-item-check-kanbans/get:
 *   get:
 *     tags:
 *       - OM Item Check Kanban
 *     summary: Get OM Item Check Kanban
 *     description: Get OM Item Check Kanban
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/om-item-check-kanbans/add:
 *   post:
 *     tags:
 *       - OM Item Check Kanban
 *     summary: Post OM Item Check Kanban
 *     description: Post OM Item Check Kanban
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/om-item-check-kanbans/edit/{id}:
 *   put:
 *     tags:
 *       - OM Item Check Kanban
 *     summary: Edit OM Item Check Kanban
 *     description: Edit OM Item Check Kanban
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/om-item-check-kanbans/delete/{id}:
 *   delete:
 *     tags:
 *       - OM Item Check Kanban
 *     summary: Delete OM Item Check Kanban
 *     description: Delete OM Item Check Kanban
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/om-item-check-kanbans/get/om-item-check-kanbans:
 *   get:
 *     tags:
 *       - OM Item Check Kanban
 *     summary: Get OM Item Check Kanban
 *     description: Get OM Item Check Kanban
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put("/edit/:id", auth.verifyToken, editOmItemCheck)
router.delete("/delete/:id", auth.verifyToken, deleteOmItemCheck)
router.post("/add", auth.verifyToken, postOmItemCheck)
router.get("/get", auth.verifyToken, getOmItemCheckKanbans)
router.get("/get/om-item-check-kanbans", auth.verifyToken, getOmGroupMachinesPaginate)


module.exports = router
