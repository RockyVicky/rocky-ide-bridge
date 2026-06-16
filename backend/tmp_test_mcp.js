const mcpManager = require('./src/utils/mcpManager');
const path = require('path');

async function test() {
  console.log('--- Starting MCP Verification Test ---');
  try {
    await mcpManager.init();
    
    console.log('\n[Test] Calling filesystem.list_directory...');
    const result = await mcpManager.callTool('filesystem', 'list_directory', { 
      path: path.resolve(__dirname, './src/agents') 
    });
    
    console.log('[Test] Files in src/agents:');
    console.log(result.content[0].text);
    
    console.log('\n[Test] Verification PASSED!');
    process.exit(0);
  } catch (err) {
    console.error('\n[Test] Verification FAILED:', err);
    process.exit(1);
  }
}

test();
