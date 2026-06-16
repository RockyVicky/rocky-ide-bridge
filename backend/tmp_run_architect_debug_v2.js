const notifier = require('./src/notifications/notifier');

// Patch BEFORE requiring architect
notifier.notify = (event, data) => {
    if (event === 'intel') {
        console.log('--- ARCHITECT INTEL START ---');
        console.log(data.raw);
        console.log('--- ARCHITECT INTEL END ---');
    }
};

const { runArchitectCycle } = require('./src/agents/architect');
require('dotenv').config();

runArchitectCycle().then(() => process.exit(0));
