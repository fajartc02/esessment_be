const router = require("express")();
const {
  getProfile,
  updateProfile,
  uploadPhoto
} = require("../../../controllers/master/profile.controllers");
const auth = require("../../../helpers/auth");
const upload = require("../../../helpers/upload");

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Get Profile
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/", auth.verifyToken, getProfile);

/**
 * @swagger
 * /api/v1/auth/profile:
 *   put:
 *     tags:
 *       - Profile
 *     summary: Update Profile
 *     responses:
 *       200:
 *         description: Success
 */
router.put("/", auth.verifyToken, updateProfile);

/**
 * @swagger
 * /api/v1/auth/profile/upload:
 *   post:
 *     tags:
 *       - Profile
 *     summary: Upload Profile Photo
 *     responses:
 *       200:
 *         description: Success
 */
router.post("/upload", auth.verifyToken, upload.single("photo"), uploadPhoto);

module.exports = router;
