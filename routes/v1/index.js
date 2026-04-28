var express = require('express');
var router = express.Router();
const response = require('../../helpers/response')
const fs = require('fs')
const stream = require('stream')

const { register, login } = require('./auth/index')
const operational = require('./operational/index')
const master = require('./master/index');
const auth = require('../../helpers/auth');
/**
 * @swagger
 * /api/v1/verify:
 *   get:
 *     tags:
 *       - Verify
 *     summary: Verify Token
 *     description: Verify Token
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A successful response
 */
router.use('/verify', auth.verifyToken, (req, res) => {
    try {
        response.success(res, req.user)
    } catch (error) {
        response.notAllowed(res, 'not authorized')
    }
})

router.use('/login', login)
router.use('/register', register)

router.use('/operational', operational)
router.use('/master', master)


/**
 * @swagger
 * /api/v1/file:
 *   get:
 *     tags:
 *       - File
 *     summary: Get File
 *     description: Get File
 *     produces:
 *       - application/pdf
 */
const path = require('path');

router.get('/file', (req, res) => {
    try {
        const userPath = req.query.path;
        if (!userPath) return res.status(400).send("Path is required");

        // 1. Tentukan folder dasar yang diizinkan (Base Directory)
        const baseDirectory = path.join(__dirname, 'public/uploads');

        // 2. Normalkan path untuk membuang ../ atau karakter aneh
        // path.normalize akan mengubah "../../windows/win.ini" menjadi "windows/win.ini"
        const safePath = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');

        // 3. Gabungkan base directory dengan path yang sudah dibersihkan
        const finalPath = path.join(baseDirectory, safePath);

        // 4. VALIDASI KRITIS: Pastikan hasil akhir masih berada di dalam baseDirectory
        if (!finalPath.startsWith(baseDirectory)) {
            console.error("Security Alert: Path Traversal Attempted!");
            return res.status(403).send("Forbidden: Access Denied");
        }

        // 5. Cek eksistensi file
        if (fs.existsSync(finalPath)) {
            // Cek ekstensi file secara aman
            const ext = path.extname(finalPath).toLowerCase();
            if (ext === '.pdf') {
                res.contentType("application/pdf");
            }
            
            // Gunakan Stream untuk efisiensi
            const stream = fs.createReadStream(finalPath);
            stream.on('error', () => res.status(500).send("Error reading file"));
            stream.pipe(res);
        } else {
            res.status(404).send("File not found");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

module.exports = router;