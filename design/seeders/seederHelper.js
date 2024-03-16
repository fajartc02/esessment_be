module.exports = {
    bulkToSchema: async (data) => {
        let containerColumn = []
        let containerValues = []

        for (const key in data[0])
        {
            containerColumn.push(key)
        }

        let mapBulkData = await data.map(item => {
            containerValues = []
            for (const key in item)
            {
                if (item[key])
                {
                    if (typeof item[key] == 'string' && item[key].startsWith('func '))
                    {
                        const r = item[key].replace('func ', '')
                        containerValues.push(`${r}`)    
                    }
                    else
                    {
                        containerValues.push(`'${item[key]}'`)    
                    }
                    
                } else
                {
                    containerValues.push(`NULL`)
                }
            }

            const r = `(${containerValues.join(',')})`
            // console.log('item', item)
            //console.log('values', r)
            return r
        })

        /* console.log('columns', containerColumn.join(','))
         */
        //console.log('values', mapBulkData.join(','))

        return {
            columns: containerColumn.join(','),
            values: mapBulkData.join(',')
        }
    }

}