var express = require('express');
var router = express.Router();

const operational = require('./operational/index')
const master = require('./master/index');

router.use('/operational', operational)
router.use('/master', master)


module.exports = router;