var express = require('express');
var router = express.Router();

const { register, login } = require('./auth/index')
const operational = require('./operational/index')

router.use('/login', login)
router.use('/register', register)

router.use('/operational', operational)

module.exports = router;