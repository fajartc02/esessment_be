function queryCondExacOpAnd(objs, dateBetweenCol = null) {
    let dateFilter = '';
    if (dateBetweenCol) {
        dateFilter = `${dateBetweenCol} BETWEEN '${objs.start_date}' AND '${objs.end_date}'`
    }
    let containerQueryCond = [];
    containerQueryCond.push(dateFilter)
    delete objs.start_date;
    delete objs.end_date;
    for (const key in objs) {
        const element = objs[key];
        if (key !== 'limit' && key !== 'currentPage') containerQueryCond.push(`${key} = '${element}'`);
    }
    return containerQueryCond.join(' AND ')
}


module.exports = queryCondExacOpAnd