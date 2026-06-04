require('dotenv').config({ path: 'dev.env' });
const _4sSchedule = require('./schedulers/4s.scheduler');

async function run() {
    try {
        console.log('Manually triggering 4S scheduler for June 2026...');
        await _4sSchedule(2026, 6);
        console.log('Completed!');
    } catch(e) {
        console.error(e);
    } finally {
        // give it some time to finish logging
        setTimeout(() => process.exit(), 5000);
    }
}

run();
