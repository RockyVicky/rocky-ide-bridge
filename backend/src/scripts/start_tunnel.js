const ngrok = require('ngrok');
const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PORT = process.env.PORT || 3001;
const RETRY_DELAY_MS = Number(process.env.TUNNEL_RETRY_DELAY_MS || 15000);
const MAX_ATTEMPTS = Number(process.env.TUNNEL_MAX_ATTEMPTS || 0);
const CONNECT_TIMEOUT_MS = Number(process.env.TUNNEL_CONNECT_TIMEOUT_MS || 12000);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, label, timeoutMs = CONNECT_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function syncMobileConfig(url, provider) {
  const configPath = path.join(__dirname, '../../../mobile-app/src/store/tunnel_config.json');
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify({ url, provider, timestamp: new Date().toISOString() }, null, 2));
  console.log(`[Sync] Updated Mobile App config at: ${configPath}`);
}

function printTunnelReady(url, provider) {
  console.log('\n' + '='.repeat(60));
  console.log(`ROCKY GLOBAL TUNNEL IS LIVE (via ${provider})`);
  console.log('='.repeat(60));
  console.log(`\nURL: ${url}`);
  console.log('\nINSTRUCTIONS:');
  console.log('1. Open Rocky App on your mobile.');
  console.log('2. Go to Setup and ensure the URL matches above.');
  console.log('='.repeat(60) + '\n');
}

async function tryNgrok() {
  console.log('[Ngrok] Attempting to establish tunnel...');
  const url = await withTimeout(ngrok.connect({ addr: PORT }), 'Ngrok connect');
  return { url, provider: 'Ngrok', close: () => ngrok.disconnect(url).catch(() => {}) };
}

async function tryLocaltunnel() {
  console.log('[Localtunnel] Falling back to localtunnel...');
  const tunnel = await withTimeout(localtunnel({ port: PORT }), 'Localtunnel connect');

  tunnel.on('error', (err) => {
    console.error('[Localtunnel] Runtime error:', err.message);
  });

  return {
    url: tunnel.url,
    provider: 'Localtunnel',
    close: () => tunnel.close(),
    tunnel,
  };
}

async function startTunnelOnce() {
  console.log(`[Tunnel] Initializing high-stability connection for port ${PORT}...`);

  if (process.env.NGROK_AUTHTOKEN) {
    try {
      return await tryNgrok();
    } catch (err) {
      console.warn('[Ngrok] Connection failed:', err.message);
      if (err.message && err.message.includes('authtoken')) {
        console.log('TIP: Check NGROK_AUTHTOKEN in your .env.');
      }
    }
  } else {
    console.log('[Ngrok] Skipping because NGROK_AUTHTOKEN is not set.');
  }

  try {
    return await tryLocaltunnel();
  } catch (err) {
    console.error('[Localtunnel] Connection failed:', err.message);
    throw err;
  }
}

async function runTunnelForever() {
  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      const tunnelInfo = await startTunnelOnce();
      attempt = 0;
      syncMobileConfig(tunnelInfo.url, tunnelInfo.provider);
      printTunnelReady(tunnelInfo.url, tunnelInfo.provider);

      if (!tunnelInfo.tunnel) {
        return;
      }

      await new Promise(resolve => {
        tunnelInfo.tunnel.once('close', () => {
          console.warn('[Localtunnel] Tunnel closed. Reconnecting...');
          resolve();
        });
      });
    } catch (err) {
      console.error(`[Tunnel] Attempt ${attempt} failed:`, err.message);
    }

    if (MAX_ATTEMPTS > 0 && attempt >= MAX_ATTEMPTS) {
      console.error(`[Tunnel] Stopping after ${MAX_ATTEMPTS} failed attempt(s).`);
      return;
    }

    console.log(`[Tunnel] Retrying in ${Math.round(RETRY_DELAY_MS / 1000)}s...`);
    await sleep(RETRY_DELAY_MS);
  }
}

process.on('unhandledRejection', (reason) => {
  const message = reason && reason.message ? reason.message : String(reason);
  console.error('[Tunnel] Unhandled async failure:', message);
});

process.on('uncaughtException', (err) => {
  console.error('[Tunnel] Uncaught failure:', err.message);
});

runTunnelForever().catch((err) => {
  console.error('[Tunnel] Fatal runner failure:', err.message);
});
