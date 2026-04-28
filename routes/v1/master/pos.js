const router = require('express')()
const { getPos, postPos, editPos, deletePos } = require('../../../controllers/master/pos.controllers')
const auth = require('../../../helpers/auth')
const upload = require('../../../helpers/upload')

/**
 * @swagger
 * /api/v1/master/pos:
 *   get:
 *     tags:
 *       - Pos
 *     summary: Get Pos
 *     description: Get Pos
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/pos:
 *   post:
 *     tags:
 *       - Pos
 *     summary: Post Pos
 *     description: Post Pos
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/pos:
 *   put:
 *     tags:
 *       - Pos
 *     summary: Put Pos
 *     description: Put Pos
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/pos:
 *   delete:
 *     tags:
 *       - Pos
 *     summary: Delete Pos
 *     description: Delete Pos
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */


router.put('/:id', auth.verifyToken, upload.fields(
    [{
        name: 'tsk',
        maxCount: 1
    },
    {
        name: 'tskk',
        maxCount: 1
    }
    ]
), editPos)
router.delete('/:id', auth.verifyToken, deletePos)
router.get('/', auth.verifyToken, getPos)
router.post('/', auth.verifyToken, upload.fields(
    [{
        name: 'tsk',
        maxCount: 1
    },
    {
        name: 'tskk',
        maxCount: 1
    }
    ]
), postPos)

module.exports = router