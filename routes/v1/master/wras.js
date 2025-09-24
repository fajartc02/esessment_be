const router = require("express")();
const {
  postWras,
  getWras,
  deleteWras,
  putWras,
} = require("../../../controllers/master/wras.controller");
const auth = require("../../../helpers/auth");

// GET semua WRAS
router.get("/", auth.verifyToken, getWras);

// GET detail WRAS by id (opsional kalau dibutuhkan di FE)
// router.get("/:id", auth.verifyToken, getWras); // nanti bisa modif getWras supaya handle req.params.id

// POST WRAS
router.post("/", auth.verifyToken, postWras);
router.put("/:id", auth.verifyToken, putWras);
// DELETE WRAS
router.delete("/:id", auth.verifyToken, deleteWras);

module.exports = router;
