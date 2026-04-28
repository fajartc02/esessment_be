const table = require('../../config/table')
const { queryPOST, queryPUT, queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const condDataNotDeleted = `deleted_dt IS NULL`

const moment = require('moment')


module.exports = {
    getPlants: async(req, res) => {
        try {
            const plants = await queryGET(table.tb_m_plants, `WHERE ${condDataNotDeleted}`, ['uuid as id', 'plant_nm', 'created_by', 'created_dt'])
            response.success(res, 'Success to get plants', plants)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get plants')
        }
    },
    postPlant: async(req, res) => {
        try {
            let idLast = await getLastIdData(table.tb_m_plants, 'plant_id') + 1
            req.body.plant_id = idLast
            req.body.uuid = req.uuid()
            let idCompany = await uuidToId(table.tb_m_companies, 'company_id', req.body.company_id)
            req.body.company_id = idCompany
            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_plants, attrsUserInsert)
            response.success(res, 'Success to add plant', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editPlant: async(req, res) => {
        try {
            let id = await uuidToId(table.tb_m_plants, 'plant_id', req.params.id)
            let idCompany = await uuidToId(table.tb_m_companies, 'company_id', req.body.company_id)
            req.body.company_id = idCompany

            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_plants, attrsUserUpdate, `WHERE plant_id = '${id}'`)
            response.success(res, 'Success to edit plant', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deletePlant: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_plants, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete plant', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }

}