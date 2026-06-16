const { runArchitectCycle } = require('./src/agents/architect');
const { notify } = require('./src/notifications/notifier');
require('dotenv').config();

// Patch notify to print raw data
const originalNotify = require('./src/notifications/notifier').notify;
require('./src/notifications/notifier').notify = (event, data) => {
    if (event === 'intel') {
        console.log('--- ARCHITECT INTEL START ---');
        console.log(data.raw);
        console.log('--- ARCHITECT INTEL END ---');
    }
};

runArchitectCycle().then(() => process.exit(0));
