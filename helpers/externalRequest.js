const axios = require('axios');

module.exports = {
    holidayRequest: async (year, month) => {
        try
        {
            const uri = `https://api-harilibur.vercel.app/api`
            const fetch = await axios.get(uri, {
                param: {
                    month: month,
                    year: year
                },
            })
            
            return fetch
        } catch (error)
        {
            const { response } = error;
            const { request, ...errorObject } = response; // take everything but 'request'
            console.log('holidayRequest', errorObject);

            return {
                data: 'something wrong'
            }
        }
    }
}