const focusThemaControllers = require("../../../controllers/operational/focusThema.controllers");
const auth = require("../../../helpers/auth");

const router = require("express")();

router.get("/get", auth.verifyToken, focusThemaControllers.getFocusThema);
router.post("/add", auth.verifyToken, focusThemaControllers.addFocusThema);
router.put("/edit/:id", auth.verifyToken, focusThemaControllers.editFocusThema);
router.delete(
  "/delete/:id",
  auth.verifyToken,
  focusThemaControllers.deleteFocusThema
);
router.put(
  "/score/:id",
  auth.verifyToken,
  focusThemaControllers.editScorefocusThema
);

module.exports = router;
