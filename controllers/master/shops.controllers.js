const table = require('../../config/table')
const { queryPOST, queryPUT, queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const idToUuid = require('../../helpers/idToUuid')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const condDataNotDeleted = `deleted_dt IS NULL`

const moment = require('moment')


module.exports = {
    getShops: async(req, res) => {
        try {
            let { id, isForm } = req.query
            let containerQuery = ''
            if (id && id != -1 && id != 'null') {
                let shop_id = await uuidToId(table.tb_m_shop, 'shop_id', id)
                containerQuery += ` AND shop_id = ${shop_id}`
            }
            let cols = ['uuid as id', 'plant_id', 'shop_nm', 'created_by', 'created_dt']
            if (isForm && isForm != -1 && isForm != 'null') {
                cols = ['uuid as id', 'shop_nm', 'plant_id']
                let shops = await queryGET(table.tb_m_shop, `WHERE ${condDataNotDeleted}${containerQuery}`, cols)
                console.log(shops);
                shops[0].plant_id = await idToUuid(table.tb_m_plants, 'plant_id', shops[0].plant_id)
                response.success(res, 'Success to get shops', shops)
                return;
            }
            let shops = await queryGET(table.tb_m_shop, `WHERE ${condDataNotDeleted}${containerQuery}`, cols)
            response.success(res, 'Success to get shops', shops)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get shops')
        }
    },
    postShop: async(req, res) => {
        try {
            let idLast = await getLastIdData(table.tb_m_shop, 'shop_id') + 1
            req.body.shop_id = idLast
            req.body.uuid = req.uuid()
            let idPlant = await uuidToId(table.tb_m_plants, 'plant_id', req.body.plant_id)
            req.body.plant_id = idPlant
            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_shop, attrsUserInsert)
            response.success(res, 'Success to add shop', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editShop: async(req, res) => {
        try {
            let id = await uuidToId(table.tb_m_shop, 'shop_id', req.params.id)
            let idPlant = await uuidToId(table.tb_m_plants, 'plant_id', req.body.plant_id)
            req.body.plant_id = idPlant
            console.log(req.body);
            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_shop, attrsUserUpdate, `WHERE shop_id = '${id}'`)
            response.success(res, 'Success to edit shop', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteShop: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_shop, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete shop', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }

}