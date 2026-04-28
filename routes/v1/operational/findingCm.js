const router = require("express")();
const {
  uploadPinksheet,
  getFindingCm,
  uploadImageFinding,
  signFinding,
  editFindingCm,
  deleteFinding,
  uploadImageCmFinding,
  uploadKzFinding,
  editscoreFinding,
} = require("../../../controllers/operational/findingCm.controllers");

const auth = require("../../../helpers/auth");
const upload = require("../../../helpers/upload");

/** 
 * @swagger
 * /api/v1/operational/finding-cm:
 *   get:
 *     tags:
 *       - Finding CM
 *     summary: Get Finding CM
 *     description: Get Finding CM
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
*/

/** 
 * @swagger
 * /api/v1/operational/finding-cm/upload-sign:
 *   put:
 *     tags:
 *       - Finding CM
 *     summary: Put Finding CM
 *     description: Put Finding CM
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
*/

/** 
 * @swagger
 * /api/v1/operational/finding-cm/upload-image:
 *   post:
 *     tags:
 *       - Finding CM
 *     summary: Post Finding CM
 *     description: Post Finding CM
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
*/

/** 
 * @swagger
 * /api/v1/operational/finding-cm/upload:
 *   post:
 *     tags:
 *       - Finding CM
 *     summary: Post Finding CM
 *     description: Post Finding CM
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
*/

/** 
 * @swagger
 * /api/v1/operational/finding-cm/edit/{id}:
 *   put:
 *     tags:
 *       - Finding CM
 *     summary: Put Finding CM
 *     description: Put Finding CM
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
*/

//score

/** 
 * @swagger
 * /api/v1/operational/finding-cm/score/{id}:
 *   put:
 *     tags:
 *       - Finding CM
 *     summary: Put Finding CM
 *     description: Put Finding CM
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
*/

/** 
 * @swagger
 * /api/v1/operational/finding-cm/delete/{id}:
 *   delete:
 *     tags:
 *       - Finding CM
 *     summary: Delete Finding CM
 *     description: Delete Finding CM
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
*/

// upload-image

/** 
 * @swagger
 * /api/v1/operational/finding-cm/upload-image:
 *   post:
 *     tags:
 *       - Finding CM
 *     summary: Post Finding CM
 *     description: Post Finding CM
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
*/

// upload-cm-image

/** 
 * @swagger
 * /api/v1/operational/finding-cm/upload-cm-image:
 *   post:
 *     tags:
 *       - Finding CM
 *     summary: Post Finding CM
 *     description: Post Finding CM
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
*/

// upload-kaizen

/** 
 * @swagger
 * /api/v1/operational/finding-cm/upload-kaizen:
 *   post:
 *     tags:
 *       - Finding CM
 *     summary: Post Finding CM
 *     description: Post Finding CM
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
*/


router.get("/", auth.verifyToken, getFindingCm);
router.put("/upload-sign", auth.verifyToken, signFinding);
router.post(
  "/upload-image",
  auth.verifyToken,
  upload.single("attachment"),
  uploadImageFinding
);
router.post(
  "/upload",
  auth.verifyToken,
  upload.single("attachment"),
  uploadPinksheet
);
router.put("/edit/:id", auth.verifyToken, editFindingCm);
router.put("/score/:id", auth.verifyToken, editscoreFinding);
router.delete("/delete/:id", auth.verifyToken, deleteFinding);

router.post(
  "/upload-image",
  auth.verifyToken,
  upload.single("attachment"),
  uploadImageFinding
);

router.post(
  "/upload-cm-image",
  auth.verifyToken,
  upload.single("cm_image"),
  uploadImageCmFinding
);

router.post(
  "/upload-kaizen",
  auth.verifyToken,
  upload.single("kaizen_file"),
  uploadKzFinding
);

module.exports = router;
