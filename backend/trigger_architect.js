const { runArchitectCycle } = require('./src/agents/architect');
const mcpManager = require('./src/utils/mcpManager');
require('dotenv').config();

console.log('--- Triggering Manual Architect Cycle ---');
mcpManager.init().then(() => {
  runArchitectCycle()
    .then(() => {
      console.log('Cycle completed.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Cycle failed:', err);
      process.exit(1);
    });
});

