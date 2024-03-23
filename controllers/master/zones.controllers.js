const table = require("../../config/table")
const { queryPUT, queryCustom, queryPOST } = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")

const moment = require("moment")
const { uuid } = require("uuidv4")

module.exports = {
  /**
   * @param {*} req
   * @param {*} res 
   * @param {JSON} req.query.id is determine for detail usecase
   */
  getZones: async (req, res) => {
    try
    {
      let { id, line_id, limit, current_page, zone_nm, freq_id } = req.query
      const fromCondition = ` 
        ${table.tb_m_zones} tmz 
        join ${table.tb_m_lines} tml on tmz.line_id = tml.line_id 
        join ${table.tb_m_freqs} tmf on tmz.freq_id = tmf.freq_id
      `

      current_page = parseInt(current_page ?? 1)
      limit = parseInt(limit ?? 10)

      let filterCondition = [
        ' and tmz.deleted_dt is null '
      ]

      let zoneQuery = `
          select
              tml.uuid as line_id,
              tmz.uuid as zone_id,
              tmf.uuid as freq_id,
              tmz.zone_nm,
              tml.line_nm,
              tmf.freq_nm,
              tmz.created_by,
              tmz.created_dt
          from
              ${fromCondition}
          where
            1 = 1
        `
      //#region filter
      if (id)
      {
        filterCondition.push(` tmz.uuid = '${id}' `)
      }
      if (line_id)
      {
        filterCondition.push(` tml.uuid = '${line_id}' `)
      }
      if (zone_nm)
      {
        filterCondition.push(` tml.zone_nm = '${zone_nm}' `)
      }
      if (freq_id)
      {
        filterCondition.push(` tmf.uuid = '${freq_id}' `)
      }

      const qOffset = (limit != -1 && limit) && current_page > 1 ? `OFFSET ${limit * (current_page - 1)}` : ``
      const qLimit = (limit != -1 && limit) ? `LIMIT ${limit}` : ``

      filterCondition = filterCondition.join(' and ')
      zoneQuery = zoneQuery.concat(` ${filterCondition} `)
      zoneQuery = zoneQuery.concat(` order by tmz.created_dt ${qLimit} ${qOffset} `)
      //#endregion

      const zones = await queryCustom(zoneQuery)
      const nullId = id == null || id == -1 || id == ''
      let result = zones.rows

      if (zones.rows.length > 0)
      {
        if (nullId)
        {
          const count = await queryCustom(`select count(tmz.zone_id) as count from ${fromCondition} where 1 = 1 ${filterCondition}`)
          const countRows = count.rows[0]
          result = {
            current_page: current_page,
            total_page: +countRows.count > 0 ? Math.ceil(countRows.count / +limit) : 0,
            limit: limit,
            list: zones.rows,
          }
        } 
        else
        {
          result = result[0]
        }
      }

      response.success(res, "Success to get zones", result)
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
        line_id: ` (select line_id from ${table.tb_m_lines} where uuid = '${req.body.line_id}') `,
        freq_id: ` (select freq_id from ${table.tb_m_freqs} where uuid = '${req.body.freq_id}') `
      }

      const attrsInsert = await attrsUserInsertData(req, insertBody)
      const result = await queryPOST(table.tb_m_zones, attrsInsert)
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
      const result = await queryPUT(
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
