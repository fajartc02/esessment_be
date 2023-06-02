const { queryGET } = require('../../helpers/query')
const { tb_m_companies } = require('../../config/table')
const response = require('../../helpers/response')

export const getCompany = async(req, res) => {
    try {
        const company = await queryGET(tb_m_companies, null, ['uuid', 'company_nm'])
        response.success(res, 'Success to get company', company)
    } catch (error) {
        console.log(error);
        response.failed(res, error)
    }
    
}