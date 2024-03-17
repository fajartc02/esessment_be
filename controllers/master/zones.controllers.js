const table = require("../../config/table")
const { queryPUT, queryCustom, queryPOSTSubQuery, queryPUTSubQuery } = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")

const moment = require("moment")
const { uuid } = require("uuidv4")

module.exports = {
  getZones: async (req, res) => {
    try
    {
      const zones = await queryCustom(`
        select
            tml.uuid as line_id,
                tmz.uuid as zone_id,
                tmz.zone_nm,
                tml.line_nm,
                tmz.created_by,
                tmz.created_dt
        from
            tb_m_zones tmz
            join tb_m_lines tml on tmz.line_id = tml.line_id
        where
          tmz.deleted_dt is null
      `)

      response.success(res, "Success to get zones", zones.rows)
    } catch (error)
    {
      console.log(error)
      response.failed(res, "Error to get zones")
    }
  },
  postZone: async (req, res) => {
    try
    {
      const insertBody = {
        ...req.body,
        uuid: uuid(),
        line_id: ` (select line_id from ${table.tb_m_lines} where uuid = '${req.body.line_id}') `
      }

      const attrsInsert = await attrsUserInsertData(req, insertBody)
      const result = await queryPOSTSubQuery(table.tb_m_zones, attrsInsert)
      response.success(res, "Success to add zone", result)
    } catch (error)
    {
      console.log(error)
      response.failed(res, error)
    }
  },
  editZone: async (req, res) => {
    try
    {
      const { zone_id, line_id } = await multipleUUidToIds([
        {
          table: table.tb_m_zones,
          col: 'zone_id',
          uuid: req.params.id
        },
        {
          table: table.tb_m_lines,
          col: 'line_id',
          uuid: req.body.line_id
        }
      ])

      const updateBody = {
        ...req.body,
        line_id: line_id,
      }

      const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
      const result = await queryPUTSubQuery(
        table.tb_m_zones,
        attrsUserUpdate,
        `WHERE zone_id = '${zone_id}'`
      )

      response.success(res, "Success to edit zone", result)
    } catch (error)
    {
      console.log(error)
      response.failed(res, error)
    }
  },
  deleteZone: async (req, res) => {
    try
    {
      let obj = {
        deleted_dt: moment().format().split("+")[0].split("T").join(" "),
        deleted_by: req.user.fullname,
      }

      let attrsUserUpdate = await attrsUserUpdateData(req, obj)
      const result = await queryPUT(
        table.tb_m_zones,
        attrsUserUpdate,
        `WHERE uuid = '${req.params.id}'`
      )
      response.success(res, "Success to soft delete zone", result)
    } catch (error)
    {
      console.log(error)
      response.failed(res, error)
    }
  },
}
