const { execSync } = require('child_process');

function killPort(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`).toString();
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes(`:${port}`) && line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          console.log(`[Free Port] Killing process ${pid} on port ${port}...`);
          try {
            execSync(`taskkill /PID ${pid} /F`);
            console.log(`[Free Port] Process ${pid} killed successfully.`);
          } catch (e) {
            console.error(`[Free Port] Failed to kill process ${pid}: ${e.message}`);
          }
        }
      }
    }
  } catch (e) {
    // Expected if no process is found
  }
}

killPort(3001);
