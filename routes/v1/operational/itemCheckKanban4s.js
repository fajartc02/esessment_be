const router = require("express")()
const {
    getItemCheckKanban4sByMainScheduleId,
    editItemCheckKanban4s
} = require("../../../controllers/operational/itemCheckKanban4s.controllers")
const auth = require("../../../helpers/auth")

router.get("/get", auth.verifyToken, getItemCheckKanban4sByMainScheduleId)
router.put('/edit/:id', auth.verifyToken, editItemCheckKanban4s)

module.exports = router
