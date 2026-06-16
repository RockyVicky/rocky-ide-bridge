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
      return {
        cancelWidth: cancel ? cancel.offsetWidth : null,
        cancelHeight: cancel ? cancel.offsetHeight : null,
        cancelOffsetParent: cancel ? !!cancel.offsetParent : null
      };
    })()`;
    const res = await cdp.call('Runtime.evaluate', { expression: evalExpr, returnByValue: true });
    console.log('Cancel Button Metrics:', res.result.value);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

test();
