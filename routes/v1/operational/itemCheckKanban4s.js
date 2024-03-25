const router = require("express")()
const {
    getItemCheckKanban4sByMainScheduleId
} = require("../../../controllers/operational/itemCheckKanban4s.controllers")
const auth = require("../../../helpers/auth")

router.get("/get", auth.verifyToken, getItemCheckKanban4sByMainScheduleId)
router.put('/edit/:id', auth.verifyToken, )

module.exports = router
