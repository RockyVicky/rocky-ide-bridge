const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { notify } = require('./notifier');
const { sendTelegramUpdate } = require('./telegram');
const { performSelfHealCheck } = require('../agents/healer');
const { addMemory } = require('../utils/database');

const REPLY_FILES = [
  path.join(__dirname, '../../tmp_antigravity_reply.txt'),
  path.join(__dirname, '../../../tmp_antigravity_reply.txt'),
];

let lastHash = null;
let bridgeStarted = false;

function hashContent(content) {
  return crypto.createHash('sha1').update(content).digest('hex');
}

function ensureReplyFiles() {
  for (const file of REPLY_FILES) {
    try {
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(file)) fs.writeFileSync(file, '');
    } catch (err) {
      console.error('[Antigravity Bridge] Failed to prepare reply file:', file, err.message);
    }
  }
}

function clearFile(file) {
  try {
    fs.truncateSync(file, 0);
  } catch (err) {
    console.error('[Antigravity Bridge] Failed to clear reply file:', file, err.message);
  }
}

function dispatchAntigravityReply(content, source = 'file') {
  const text = String(content || '').trim();
  if (!text) return false;

  const contentHash = hashContent(text);
  if (contentHash === lastHash) return false;
  lastHash = contentHash;

  addMemory('Antigravity Reply', text).catch(() => {});
  performSelfHealCheck(text);

  const message = `Antigravity: ${text}`;
  notify('log', { message });
  notify('intel', {
    id: contentHash,
    raw: text,
    source: `ANTIGRAVITY:${source.toUpperCase()}`,
  });
  sendTelegramUpdate(message);
  return true;
}

function processReplyFile(file) {
  try {
    const content = fs.readFileSync(file, 'utf8').trim();
    if (!content) return;
    const dispatched = dispatchAntigravityReply(content, 'file');
    if (dispatched) clearFile(file);
  } catch (err) {
    console.error('[Antigravity Bridge] Read error:', err.message);
  }
}

function startAntigravityBridge() {
  if (bridgeStarted) return;
  bridgeStarted = true;
  ensureReplyFiles();

  for (const file of REPLY_FILES) {
    fs.watchFile(file, { interval: 500 }, () => processReplyFile(file));
  }

  setInterval(() => {
    for (const file of REPLY_FILES) processReplyFile(file);
  }, 1500);

  for (const file of REPLY_FILES) processReplyFile(file);
}

module.exports = { dispatchAntigravityReply, startAntigravityBridge };
