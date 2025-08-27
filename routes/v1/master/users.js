const router = require("express")();
const {
  getUsersOpts,
  postUser,
  editUser,
  deleteUser,
  editRole,
} = require("../../../controllers/master/users.controllers");
const auth = require("../../../helpers/auth");

/**
 * @swagger
 * /api/v1/master/users:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get Users
 *     description: Get Users
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/users:
 *   post:
 *     tags:
 *       - Users
 *     summary: Post Users
 *     description: Post Users
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/users/{id}:
 *   put:
 *     tags:
 *       - Users
 *     summary: Edit Users
 *     description: Edit Users
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/users/{id}:
 *   delete:
 *     tags:
 *       - Users
 *     summary: Delete Users
 *     description: Delete Users
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/users/role/{id}:
 *   put:
 *     tags:
 *       - Users
 *     summary: Edit Role
 *     description: Edit Role
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

/**
 * @swagger
 * /api/v1/master/users/opts:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get Users Opts
 *     description: Get Users Opts
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */

router.put("/edit/:id", auth.verifyToken, editUser);
router.delete("/delete/:id", auth.verifyToken, deleteUser);
router.post("/", auth.verifyToken, postUser);
router.get("/opts", auth.verifyToken, getUsersOpts);
router.put("/role/:id", auth.verifyToken, editRole);

module.exports = router;
