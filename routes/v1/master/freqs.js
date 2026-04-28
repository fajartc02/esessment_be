const router = require("express")()
const {
    getFreqs,
    postFreq,
    editFreq,
    deleteFreq
} = require("../../../controllers/master/freqs.controllers")
const auth = require("../../../helpers/auth")


/**
 * @swagger
 * /api/v1/master/freqs/get:
 *   get:
 *     tags:
 *       - Frequency
 *     summary: Get Frequency
 *     description: Get Frequency
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/freqs/add:
 *   post:
 *     tags:
 *       - Frequency
 *     summary: Post Frequency
 *     description: Post Frequency
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/freqs/edit/{id}:
 *   put:
 *     tags:
 *       - Frequency
 *     summary: Edit Frequency
 *     description: Edit Frequency
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/freqs/delete/{id}:
 *   delete:
 *     tags:
 *       - Frequency
 *     summary: Delete Frequency
 *     description: Delete Frequency
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put("/edit/:id", auth.verifyToken, editFreq)
router.delete("/delete/:id", auth.verifyToken, deleteFreq)
router.post("/add", auth.verifyToken, postFreq)
router.get("/get", auth.verifyToken, getFreqs)

module.exports = router
