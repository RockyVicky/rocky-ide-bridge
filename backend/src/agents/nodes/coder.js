const modelRouter = require('../../models/modelRouter');
const mcpManager = require('../../utils/mcpManager');
const { log, notify } = require('../../notifications/notifier');
const { v4: uuidv4 } = require('uuid');

async function coderNode(state) {
  log(null, null, `[Graph:Coder] Starting implementation phase...`);
  
  const results = [];
  for (const step of state.plan) {
    log(null, null, `[Graph:Coder] Executing step: ${step.title}`);
    
    if (step.type === 'code') {
       const prompt = `You are the Rocky Implementation Agent. 
Current Task: ${step.description}
Project Context: ${state.objective}

Generate the necessary code changes. Use the MCP filesystem tool to write files.
For each file change, provide:
- path: Relative path to file
- content: Full new content of the file

Format: Return a JSON array of objects with 'path' and 'content'.`;

       const response = await modelRouter.call([{ role: 'user', content: prompt }]);
       
       try {
         const cleaned = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
         const changes = JSON.parse(cleaned);
         
         for (const change of changes) {
            log(null, null, `[Graph:Coder] Writing file: ${change.path}`);
            await mcpManager.callTool('filesystem', 'write_file', {
                path: change.path,
                content: change.content
            });
            results.push(`Successfully wrote ${change.path}`);
         }
       } catch (err) {
         console.error('[CoderNode] Failed to apply changes:', err);
         results.push(`Failed to apply changes for step: ${step.title}`);
       }
    }
  }

  const finalResult = results.join('\n');
  
  // Push Intel Update
  notify('intel', {
     id: uuidv4(),
     raw: `[GRAPH COMPLETE]\n${finalResult}`,
     source: 'GRAPH-ENGINE'
  });

  return { 
    result: finalResult,
    status: 'finished'
  };
}

module.exports = coderNode;
