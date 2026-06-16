const { runGraph } = require('./src/agents/graphEngine');
const mcpManager = require('./src/utils/mcpManager');

async function test() {
  console.log('--- Starting LangGraph Integration Test ---');
  try {
    await mcpManager.init();
    
    const objective = "Create a new file called 'hello_from_langgraph.txt' in the root directory with the content 'LangGraph is active!'";
    
    const result = await runGraph(objective);
    
    console.log('\n[Test] Graph Result:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n[Test] Verification PASSED!');
    process.exit(0);
  } catch (err) {
    console.error('\n[Test] Verification FAILED:', err);
    process.exit(1);
  }
}

test();
