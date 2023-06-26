const router = require('express')()
const { getJobType, postJobType, editJobType, deleteJobType } = require('../../../controllers/master/jobType.controllers')
const auth = require('../../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editJobType)
router.delete('/delete/:id', auth.verifyToken, deleteJobType)
router.post('/', auth.verifyToken, postJobType)
router.get('/', auth.verifyToken, getJobType)

module.exports = router