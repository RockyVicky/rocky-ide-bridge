const path = require('path');

module.exports = {
  servers: {
    filesystem: {
      command: 'node',
      args: [
        path.join(__dirname, '../../node_modules/@modelcontextprotocol/server-filesystem/dist/index.js'),
        path.join(__dirname, '../../../') // Allow access to the entire Autonomous folder
      ]
    }
  }
};
