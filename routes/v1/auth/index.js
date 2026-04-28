const register = require('./register')
const login = require('./login')

/**
 * @swagger
 * /api/v1/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login
 *     description: Login
 *     produces:
 *       - application/json
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: A successful response
 */

// swagger register
/**
 * @swagger
 * /api/v1/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register
 *     description: Register
 *     produces:
 *       - application/json
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: A successful response
 */

module.exports = {
    register,
    login
}