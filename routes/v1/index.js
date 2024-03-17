var express = require('express');
var router = express.Router();
const response = require('../../helpers/response')
const fs = require('fs')
const stream = require('stream')

const { register, login } = require('./auth/index')
const operational = require('./operational/index')
const master = require('./master/index');
const auth = require('../../helpers/auth');

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


router.get('/file', (req, res) => {
    const path = req.query.path
    if (fs.existsSync(path)) {
        if(path.includes('pdf')) {
            res.contentType("application/pdf");
        }
        fs.createReadStream(path).pipe(res)
    } else {
        res.status(500)
        console.log('File not found')
        res.send('File not found')
    }
})

module.exports = router;