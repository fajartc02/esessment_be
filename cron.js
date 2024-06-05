const cron = require('node-cron');
const _4sSchedule = require('./schedulers/4s.scheduler')
const omSchedule = require('./schedulers/om.scheduler')

/**
 * monthly running
 */
cron.schedule('* 0 1 * * *', async () => {
    await _4sSchedule()
    await omSchedule()
});