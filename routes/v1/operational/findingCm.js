const router = require('express')()
const {
    uploadPinksheet,
    getFindingCm
} = require('../../../controllers/operational/findingCm.controllers')

const auth = require('../../../helpers/auth')
const upload = require('../../../helpers/upload')

router.get('/', auth.verifyToken, getFindingCm)

router.post('/upload', auth.verifyToken, upload.single('attachment'), uploadPinksheet);


module.exports = router