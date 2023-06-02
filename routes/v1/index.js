var express = require('express');
var router = express.Router();

const { register, login } = require('./auth/index')
    // const master = require('./master/index')

router.use('/login', login)
router.use('/register', register)

// router.use('/master', master)

module.exports = router;