const router = require("express")()
const {
    getOmItemCheckKanbans,
    getOmGroupMachinesPaginate,
    postOmItemCheck,
    editOmItemCheck,
    deleteOmItemCheck
} = require("../../../controllers/master/itemCheckKanbanOm.controllers")

const auth = require("../../../helpers/auth")

router.put("/edit/:id", auth.verifyToken, editOmItemCheck)
router.delete("/delete/:id", auth.verifyToken, deleteOmItemCheck)
router.post("/add", auth.verifyToken, postOmItemCheck)
router.get("/get", auth.verifyToken, getOmItemCheckKanbans)
router.get("/get/groups", auth.verifyToken, getOmGroupMachinesPaginate)


module.exports = router
