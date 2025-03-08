const table = require('../../../config/table')
const { queryGET, queryPOST, queryPUT, queryTransaction, queryGetTransaction } = require('../../../helpers/query')

const response = require('../../../helpers/response')
const condDataNotDeleted = `deleted_dt IS NULL`

module.exports = {
    getSubCategories: async (req, res) => {
        try {
            await queryTransaction(async (db) => {
                const categories = await queryGetTransaction(db, table.tb_m_categories, `WHERE ${condDataNotDeleted} ORDER BY category_id`, ['uuid as id', 'category_id', 'category_nm', 'created_dt', 'created_by'])
                const sub_categories = await categories.map(async (category) => {
                    const sub_categories = await queryGetTransaction(db, table.tb_m_sub_categories, `WHERE category_id = '${category.category_id}'`)

                    category.sub_categories = sub_categories
                    delete category.category_id
                    return category
                })
                const waitPromise = await Promise.all(sub_categories)
                response.success(res, 'Success to get SubCategories', waitPromise)
                return true
            })
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get SubCategories')
        }
    }
}