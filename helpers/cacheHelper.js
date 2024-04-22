const cache = require('memory-cache')
const defaultDissapearTime = 30 * 1000 // 10 minute

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

const cacheDelete = (key, isFind = false) => {
    if (isFind)
    {
        const cacheData = cache.keys()
        if (cacheData.includes(key))
        {
            key = cacheData.find((item) => item.includes(key))
        }
    }

    const cacheData = cache.keys()
    console.log('cacheData', cacheData);
    console.log('cachekeydeleted', key);
    
    return cache.del(key)
}

module.exports = {
    cache,
    cacheGet,
    cacheAdd,
    cacheUpdate,
    cacheDelete
}

