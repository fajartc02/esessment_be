const router = require("express")()
const {
  getZones,
  postZone,
  editZone,
  deleteZone
} = require("../../../controllers/master/zones.controllers")
const auth = require("../../../helpers/auth")


/**
 * @swagger
 * /api/v1/master/zones:
 *   get:
 *     tags:
 *       - Zones
 *     summary: Get Zones
 *     description: Get Zones
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/zones:
 *   post:
 *     tags:
 *       - Zones
 *     summary: Post Zones
 *     description: Post Zones
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/zones/edit/{id}:
 *   put:
 *     tags:
 *       - Zones
 *     summary: Edit Zones
 *     description: Edit Zones
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/zones/delete/{id}:
 *   delete:
 *     tags:
 *       - Zones
 *     summary: Delete Zones
 *     description: Delete Zones
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put("/edit/:id", auth.verifyToken, editZone)
router.delete("/delete/:id", auth.verifyToken, deleteZone)
router.post("/add", auth.verifyToken, postZone)
router.get("/get", auth.verifyToken, getZones)

module.exports = router
