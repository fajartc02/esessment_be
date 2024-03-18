const router = require("express")()
const {
    getFreqs,
    postFreq,
    editFreq,
    deleteFreq
} = require("../../../controllers/master/freqs.controllers")
const auth = require("../../../helpers/auth")

router.put("/edit/:id", auth.verifyToken, editFreq)
router.delete("/delete/:id", auth.verifyToken, deleteFreq)
router.post("/", auth.verifyToken, postFreq)
router.get("/", auth.verifyToken, getFreqs)

module.exports = router
