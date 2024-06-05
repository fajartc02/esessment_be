const cache = require('memory-cache')
const defaultDissapearTime = 5 * 1000 // 30 minute

const cacheGet = (key) => {
    return cache.get(key);
}

const cacheAdd = (key, value, dissapearTime = defaultDissapearTime) => {
    return cache.put(key, value, dissapearTime);
}

const cacheUpdate = (key, value, dissapearTime = defaultDissapearTime) => {
    cache.del(key);
    return cache.put(key, value, dissapearTime);
}

const cacheDelete = (key) => {
    let result = cache.del(key)
    console.log('original key', key);
    if (!result)
    {
        const cacheData = cache.keys()
        console.log('cacheKeyBefore', cacheData);
        if (cacheData.length > 0)
        {
            for (let i = 0; i < cacheData.length; i++)
            {
                if (cacheData[i].includes(key))
                {
                    result = cache.del(cacheData[i])
                    console.log('finded key', cacheData[i]);
                }
            }
        }

        console.log('cacheKeyAfter', cache.keys());
    }

    console.log('deletedstatus', result);
    return result
}

module.exports = {
    cache,
    cacheGet,
    cacheAdd,
    cacheUpdate,
    cacheDelete
}

