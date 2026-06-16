const { discoverCDP, connectCDP } = require('./src/agents/cdpBridge');

async function main() {
  try {
    const wsUrl = await discoverCDP();
    console.log('Found CDP:', wsUrl);
    const cdp = await connectCDP(wsUrl);
    
    // Dump outerHTML of the last few elements in the chat to see structure
    const expr = `(async () => {
      // Find all articles or common message wrappers
      let nodes = document.querySelectorAll('[role="article"]');
      if (nodes.length === 0) {
        nodes = document.querySelectorAll('.agent-turn, .user-turn, [data-message-author-role]');
      }
      if (nodes.length === 0) {
        return 'No message nodes found. document.body.innerHTML: ' + document.body.innerHTML.substring(0, 1000);
      }
      
      const lastNodes = Array.from(nodes).slice(-3); // Get last 3 nodes to see both user and agent
      return lastNodes.map(n => n.outerHTML).join('\\n\\n---NEXT NODE---\\n\\n');
    })()`;
    
    const { evalInContexts } = require('./src/agents/cdpBridge');
    // We don't have evalInContexts exported natively, so we'll just run it ourselves:
    let resultHTML = null;
    for (const ctx of cdp.contexts) {
      try {
        const result = await cdp.call('Runtime.evaluate', {
          expression: expr,
          returnByValue: true,
          awaitPromise: true,
          contextId: ctx.id,
        });
        if (result.result && result.result.value) {
          resultHTML = result.result.value;
          break;
        }
      } catch (e) {}
    }
    
    const fs = require('fs');
    fs.writeFileSync('dom_dump.txt', resultHTML || 'Nothing found');
    console.log('Dumped to dom_dump.txt');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
