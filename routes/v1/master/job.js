const router = require('express')()
const { getJob, postJob, editJob, deleteJob, uploadJobSop } = require('../../../controllers/master/job.controllers')
const auth = require('../../../helpers/auth')
const upload = require('../../../helpers/upload')

router.put('/upload-sop', auth.verifyToken, upload.single('attachment'), uploadJobSop)

router.put('/:id', auth.verifyToken, upload.single('attachment'), editJob)
router.delete('/:id', auth.verifyToken, deleteJob)
router.get('/', auth.verifyToken, getJob)
router.post('/', auth.verifyToken, upload.single('attachment'), postJob)

module.exports = router