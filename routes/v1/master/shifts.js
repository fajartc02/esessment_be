const router = require("express")()
const {
    getShifts,
    postShift,
    editShift,
    deleteShift
} = require("../../../controllers/master/shifts.controllers")
const auth = require("../../../helpers/auth")

router.put("/edit/:id", auth.verifyToken, editShift)
router.delete("/delete/:id", auth.verifyToken, deleteShift)
router.post("/add", auth.verifyToken, postShift)
router.get("/get", auth.verifyToken, getShifts)

module.exports = router
