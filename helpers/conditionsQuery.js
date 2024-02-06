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
        containerQueryCond.push(`${key} = '${element}'`);
        console.log();
    }
    return containerQueryCond.join(' AND ')
}


module.exports = queryCondExacOpAnd