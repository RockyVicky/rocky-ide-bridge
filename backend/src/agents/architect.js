const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const modelRouter = require('../models/modelRouter');
const { notify, log } = require('../notifications/notifier');

async function runArchitectCycle() {
  log(null, null, '[Architect] Waking up. Gathering system context...');

  try {
    // 1. Gather Context via MCP
    let packagesStr = 'Unknown';
    try {
      const mcpManager = require('../utils/mcpManager');
      const backendPkg = await mcpManager.callTool('filesystem', 'read_file', { path: path.resolve(__dirname, '../../package.json') });
      const mobilePkg = await mcpManager.callTool('filesystem', 'read_file', { path: path.resolve(__dirname, '../../../mobile-app/package.json') });
      
      const pkg = JSON.parse(backendPkg.content[0].text);
      const mPkg = JSON.parse(mobilePkg.content[0].text);
      
      packagesStr = `Backend Deps: ${Object.keys(pkg.dependencies || {}).join(', ')}. Mobile Deps: ${Object.keys(mPkg.dependencies || {}).join(', ')}`;
    } catch (e) {
      console.error('[Architect] MCP Context Gather Failed:', e.message);
    }

    
    // 2. Multi-Source Intelligence Gathering
    log(null, null, '[Architect] Scanning global intelligence sources...');
    let intelSummary = '';

    // A. Dev.to AI Articles
    try {
       const resp = await axios.get('https://dev.to/api/articles?tag=ai&top=5', { timeout: 10000 });
       intelSummary += "\n--- DEV.TO TRENDS ---\n" + resp.data.slice(0, 3).map(a => `Title: ${a.title}\nDescription: ${a.description}`).join("\n\n");
    } catch(e) { intelSummary += "\nDev.to scan failed."; }

    // B. Hacker News (Trending AI)
    try {
       const hnResp = await axios.get('https://hn.algolia.com/api/v1/search?query=AI+Agent&tags=story&hitsPerPage=3', { timeout: 10000 });
       intelSummary += "\n--- HACKER NEWS AI ---\n" + hnResp.data.hits.map(h => `Title: ${h.title}\nURL: ${h.url}`).join("\n\n");
    } catch(e) { intelSummary += "\nHacker News scan failed."; }

    // C. GitHub Trends (Conceptual)
    intelSummary += "\n--- GITHUB TRENDS ---\nRecent interest in MCP (Model Context Protocol), LangGraph, and CrewAI observed in database history.";

    // 3. Evaluate with LLM
    const prompt = `You are the Rocky Meta-Architect (v2.0).
Current Ecosystem:
${packagesStr}

Latest Intel from Web:
${intelSummary}

Your Goal: Evaluate which 1 advanced AI technology, framework, or protocol should be integrated next. 
Focus on:
1. Model Context Protocol (MCP) for tool standardization.
2. LangGraph for stateful agent workflows.
3. Automated Email/Job application agents (LoopCV style).

Provide a "PROSPECTIVE UPGRADE" report. Be bold but technical. Under 200 words.`;

    log(null, null, '[Architect] Evaluating v2.0 upgrade across models...');
    const result = await modelRouter.call([{ role: 'user', content: prompt }]);
    
    if (result && result.content) {
       log(null, null, '[Architect] Pushing [INTEL v2.0] to mobile app.');
       
       notify('intel', {
          id: uuidv4(),
          raw: result.content,
          source: 'META-ARCHITECT-V2'
       });
    }

  } catch (err) {
    console.error('[Architect Error]', err);
    log(null, null, `[Architect] Cycle failed: ${err.message}`);
  }
}

module.exports = { runArchitectCycle };
