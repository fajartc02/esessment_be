const router = require('express')()
const {
    uploadPinksheet,
    getFindingCm,
    uploadImageFinding,
    signFinding,
    editFindingCm,
    deleteFinding
} = require('../../../controllers/operational/findingCm.controllers')

const auth = require('../../../helpers/auth')
const upload = require('../../../helpers/upload')

router.get('/', auth.verifyToken, getFindingCm)
router.put('/upload-sign', auth.verifyToken, signFinding);
router.post('/upload-image', auth.verifyToken, upload.single('attachment'), uploadImageFinding);
router.post('/upload', auth.verifyToken, upload.single('attachment'), uploadPinksheet);
router.put('/edit/:id', auth.verifyToken, editFindingCm)
router.delete('/delete/:id', auth.verifyToken, deleteFinding)


module.exports = router