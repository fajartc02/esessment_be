const router = require('express')()
const { getPos, postPos, editPos, deletePos } = require('../../../controllers/master/pos.controllers')
const auth = require('../../../helpers/auth')
const upload = require('../../../helpers/upload')

router.put('/:id', auth.verifyToken, upload.fields(
    [{
            name: 'tsk',
            maxCount: 1
        },
        {
            name: 'tskk',
            maxCount: 1
        }
    ]
), editPos)
router.delete('/:id', auth.verifyToken, deletePos)
router.get('/', auth.verifyToken, getPos)
router.post('/', auth.verifyToken, upload.fields(
    [{
            name: 'tsk',
            maxCount: 1
        },
        {
            name: 'tskk',
            maxCount: 1
        }
    ]
), postPos)

module.exports = router