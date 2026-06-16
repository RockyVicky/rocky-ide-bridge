const { discoverCDP, connectCDP, readLatestResponse } = require('./src/agents/cdpBridge');

async function main() {
  try {
    console.log("Discovering CDP...");
    const wsUrl = await discoverCDP();
    console.log("Connected to", wsUrl);
    const cdp = await connectCDP(wsUrl);
    
    console.log("Reading latest response...");
    const snap = await readLatestResponse(cdp);
    console.log("Result:", JSON.stringify(snap, null, 2));
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
