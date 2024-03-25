const router = require("express")()
const {
  getZones,
  postZone,
  editZone,
  deleteZone
} = require("../../../controllers/master/zones.controllers")
const auth = require("../../../helpers/auth")

router.put("/edit/:id", auth.verifyToken, editZone)
router.delete("/delete/:id", auth.verifyToken, deleteZone)
router.post("/add", auth.verifyToken, postZone)
router.get("/get", auth.verifyToken, getZones)

module.exports = router
