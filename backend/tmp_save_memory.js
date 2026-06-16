const { addMemory } = require('./src/utils/database');

async function saveMemory() {
  const prompt = "Resolving backend EADDRINUSE (Port 3001) and Telegram ENOTFOUND errors";
  const result = "1. EADDRINUSE occurs when Node process gets stuck on port 3001. Fixed permanently by adding `prestart` script in package.json to run `src/scripts/free_port.js` which automatically kills the stuck PID on Windows using netstat/taskkill.\n" +
                 "2. ENOTFOUND when starting bot implies internet connectivity/DNS failure, causing Telegram's bot.launch() to hang in 'initializing' state, silently preventing message replies. Ensure internet is active.\n" +
                 "3. DOM extraction bug for Telegram responses fixed in `cdpBridge.js` by targeting the last agent response container and restricting text selection to `.leading-relaxed` instead of globally.";
  
  try {
    await addMemory(prompt, result);
    console.log("Memory successfully added to database.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to add memory:", err);
    process.exit(1);
  }
}

saveMemory();
