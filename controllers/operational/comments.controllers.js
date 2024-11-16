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
      response.success(res, `Success to get comments with id: ${observation_id}`, containerMock)
    } catch (error) {
      console.log(error)
      response.failed(res, error)
    }
  },
  postComments: async (req, res) => {
    try {
      containerMock.push(req.body)
      response.success(res, 'Success to post comments', req.body)
    } catch (error) {
      console.log(error)
      response.failed(res, error)
    }
  }
}
