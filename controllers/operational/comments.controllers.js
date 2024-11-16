const table = require("../../config/table")
const { queryPUT, queryGET, queryCustom, queryPOST, queryTransaction, queryPostTransaction, queryPutTransaction } = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")

const moment = require("moment")
const { uuid } = require("uuidv4")
const containerMock = [
  {
    name: 'Jhone Doe',
    noreg: '2',
    comments: 'test comments',
    created_dt: '2022-09-01 00:00:00',
    observation_id: '1',
  },
  {
    name: 'Jhone Doe',
    noreg: '2',
    comments: 'test comments 12',
    created_dt: '2022-09-01 00:00:00',
    observation_id: '1',
  },
  {
    name: 'Jhone Doe',
    noreg: '2',
    comments: 'test comments',
    created_dt: '2022-09-01 00:00:00',
    observation_id: '1',
  },
  {
    name: 'Jhone Doe',
    noreg: '2',
    comments: 'test comments',
    created_dt: '2022-09-01 00:00:00',
    observation_id: '1',
  }
]

module.exports = {
  getComments: async (req, res) => {
    try {
      const { observation_id } = req.query
      const responseData = await queryGET(
        table.tb_r_observations_comments,
        `WHERE observation_id = (select observation_id from tb_r_observations WHERE uuid = '${observation_id}')`,
        ['uuid as id', 'comments', 'created_dt', 'name', 'noreg'],
      )
      response.success(res, `Success to get comments with id: ${observation_id}`, responseData)
    } catch (error) {
      console.log(error)
      response.failed(res, error)
    }
  },
  postComments: async (req, res) => {
    try {
      req.body.created_by = req.user.noreg
      let { comments, observation_id, name, noreg, created_dt, created_by } = req.body
      const data = {
        id: `(select COALESCE(MAX(id), 0) + 1 FROM tb_r_observations_comments)`,
        uuid: req.uuid(),
        comments,
        observation_id: `(select observation_id from tb_r_observations WHERE uuid = '${observation_id}')`,
        name,
        noreg,
        created_dt,
        created_by
      }
      const responseData = await queryPOST(table.tb_r_observations_comments, data)
      // containerMock.push(req.body)
      response.success(res, 'Success to post comments')
    } catch (error) {
      console.log(error)
      response.failed(res, 'Internal error')
    }
  }
}
