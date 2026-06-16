const { discoverCDP, connectCDP, injectMessage } = require('./src/agents/cdpBridge');

async function waitForResponse(cdp, timeoutMs = 60000, baselineText = '') {
  const { readLatestResponse } = require('./src/agents/cdpBridge');
  const deadline = Date.now() + timeoutMs;
  console.log(`[Test] Baseline response text length: ${baselineText.length} chars. Text: "${baselineText.substring(0, 50)}"`);
  await new Promise(r => setTimeout(r, 3000));
  let lastText = '';
  let stableCount = 0;
  let generationSeen = false;

  while (Date.now() < deadline) {
    const snap = await readLatestResponse(cdp);
    if (!snap) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }
    const currentText = snap.text || '';
    
    if (currentText && currentText !== baselineText) {
      if (currentText === lastText) {
        stableCount++;
        const requiredCount = snap.status === 'idle' ? 2 : 4;
        console.log(`[Test] Stable count: ${stableCount}/${requiredCount} (status: ${snap.status})`);
        if (stableCount >= requiredCount) {
          console.log(`[Test] Response stable. Returning.`);
          return currentText; 
        }
      } else {
        lastText = currentText;
        stableCount = 0;
        console.log(`[Test] Generating... (${lastText.length} chars so far). Status: ${snap.status}`);
      }
      generationSeen = true;
    } else {
      console.log(`[Test] currentText == baselineText or empty. Status: ${snap.status}, currentText length: ${currentText.length}`);
      if (snap.status === 'generating') {
        generationSeen = true;
      }
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return lastText || null;
}

async function main() {
  try {
    const wsUrl = await discoverCDP();
    const cdp = await connectCDP(wsUrl);
    
    const { readLatestResponse } = require('./src/agents/cdpBridge');
    const baseSnap = await readLatestResponse(cdp);
    const baselineText = baseSnap?.text || '';
    
    console.log("Injecting message...");
    await injectMessage(cdp, "Say 'Hello Telegram' as a short test.");
    
    console.log("Waiting for response...");
    const result = await waitForResponse(cdp, 30000, baselineText);
    console.log("Final Result:", result);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
