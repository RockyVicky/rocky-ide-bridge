const { discoverCDP, connectCDP, readLatestResponse } = require('../backend/src/agents/cdpBridge');

async function test() {
  try {
    console.log('Discovering CDP...');
    const wsUrl = await discoverCDP();
    console.log('CDP URL:', wsUrl);
    const cdp = await connectCDP(wsUrl);
    console.log('Connected');
    
    const evalExpr = `(() => {
      const cancel = document.querySelector('[data-tooltip-id="input-send-button-cancel-tooltip"]');
      const sendBtn = document.querySelector('svg.lucide-arrow-right')?.closest('button');
      return {
        cancelHtml: cancel ? cancel.outerHTML : null,
        sendHtml: sendBtn ? sendBtn.outerHTML : null,
        cancelStyle: cancel ? window.getComputedStyle(cancel).display + ' / ' + window.getComputedStyle(cancel).visibility : null
      };
    })()`;
    const res = await cdp.call('Runtime.evaluate', { expression: evalExpr, returnByValue: true });
    console.log('Button DOM Info:', JSON.stringify(res.result.value, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

test();
