const { Telegraf } = require('telegraf');
const { log } = require('./notifier');
const dns = require('dns');

// dns.setDefaultResultOrder('ipv4first');



let bot;
let botStatus = 'not_initialized';
let botError = null;
const AUTHORIZED_USER_ID = process.env.TELEGRAM_USER_ID;

// ─── CDP connection cache ──────────────────────────────────────────────────
let _cdp = null;

async function getCdp() {
  const { discoverCDP, connectCDP } = require('../agents/cdpBridge');

  // Test cached connection
  if (_cdp) {
    try {
      await _cdp.call('Runtime.evaluate', { expression: '1' });
      return _cdp;
    } catch {
      _cdp = null;
    }
  }

  const wsUrl = await discoverCDP();
  _cdp = await connectCDP(wsUrl);
  console.log('[Telegram] CDP connection established to Antigravity.');
  return _cdp;
}

// ─── Wait for IDE response ─────────────────────────────────────────────────
async function waitForResponse(cdp, timeoutMs = 120000, baselineText = '') {
  const { readLatestResponse } = require('../agents/cdpBridge');
  const deadline = Date.now() + timeoutMs;

  console.log(`[Telegram] Baseline response text length: ${baselineText.length} chars`);

  // Small initial pause for generation to START
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
        // If IDE reports idle, wait 2 checks (3s). If it reports generating, wait 4 checks (6s) 
        // to handle cases where the UI 'generating' state gets stuck or pauses for permissions.
        const requiredCount = snap.status === 'idle' ? 2 : 4;
        
        if (stableCount >= requiredCount) {
          console.log(`[Telegram] Response stable at ${currentText.length} chars. Returning.`);
          return currentText; 
        }
      } else {
        lastText = currentText;
        stableCount = 0;
        console.log(`[Telegram] Generating... (${lastText.length} chars so far)`);
      }
      generationSeen = true;
    } else {
      if (snap.status === 'generating') {
        generationSeen = true;
      } else if (generationSeen && !currentText) {
        // Was generating but now text is gone — might be clearing; wait
      }
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  // Return what we have if it's different from baseline, else null
  const finalText = lastText || '';
  if (finalText && finalText !== baselineText) return finalText;
  return null;
}

// ─── Split long text into Telegram-safe chunks ────────────────────────────
function splitChunks(text, maxLen = 3500) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, maxLen));
    remaining = remaining.slice(maxLen);
  }
  return chunks;
}

// ─── Init bot ─────────────────────────────────────────────────────────────
function initTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    botStatus = 'missing_token';
    console.error('[Telegram] Missing TELEGRAM_BOT_TOKEN. Telegram tunnel disabled.');
    return;
  }

  botStatus = 'initializing';
  bot = new Telegraf(token, {
    telegram: {
      apiRoot: process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org'
    }
  });

  // Security: only authorized user
  bot.use(async (ctx, next) => {
    if (AUTHORIZED_USER_ID && ctx.from?.id?.toString() !== AUTHORIZED_USER_ID.toString()) {
      console.warn(`[Telegram] Unauthorized attempt from ID: ${ctx.from?.id}`);
      return ctx.reply('Unauthorized.');
    }
    return next();
  });

  bot.start(ctx => ctx.reply('🤖 Rocky Bridge Online.\n\nSend me any message and I will relay it to Antigravity and return the response.'));
  bot.command('status', ctx => ctx.reply(`Bridge status: ${botStatus}`));

  bot.catch((err) => {
    console.error('[Telegram] Background error:', err.message);
  });

  bot.on('text', async ctx => {
    const text = ctx.message.text?.trim();
    if (!text || text.startsWith('/')) return;

    // Immediate ack
    const ackMsg = await ctx.reply('📨 Received. Injecting into Antigravity...');

    try {
      // Register in DB
      const { v4: uuidv4 } = require('uuid');
      const { createGoal } = require('../utils/database');
      const goalId = uuidv4();
      await createGoal(goalId, text, 'Telegram Bridge');
      log(goalId, null, `[Telegram] Prompt: ${text}`);

      // Connect to IDE
      let cdp;
      try {
        cdp = await getCdp();
      } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, ackMsg.message_id, null,
          `❌ Could not connect to Antigravity IDE.\n\nMake sure Antigravity is open.\n\nError: ${e.message}`);
        return;
      }

      // Capture baseline BEFORE injection to detect what's truly new
      const { readLatestResponse, injectMessage } = require('../agents/cdpBridge');
      let baselineText = '';
      try {
        const baseSnap = await readLatestResponse(cdp);
        baselineText = baseSnap?.text || '';
      } catch (e) { /* ignore */ }

      // Inject
      const injResult = await injectMessage(cdp, text);
      if (!injResult || !injResult.ok) {
        await ctx.telegram.editMessageText(ctx.chat.id, ackMsg.message_id, null,
          `❌ Failed to inject into IDE.\n\nReason: ${injResult?.reason || injResult?.error || 'unknown'}\n\nMake sure the Antigravity chat window is visible and not busy.`);
        return;
      }

      await ctx.telegram.editMessageText(ctx.chat.id, ackMsg.message_id, null,
        `✅ Injected! Waiting for Antigravity's response...`);

      // Poll for response (pass the baseline so we don't return old text)
      const responseText = await waitForResponse(cdp, 120000, baselineText);

      if (!responseText) {
        await ctx.reply('⏱ Timed out waiting for a response. Antigravity may still be working — check the IDE.');
        return;
      }

      // Send response back in chunks
      const chunks = splitChunks(responseText);
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }

    } catch (err) {
      console.error('[Telegram] Handler error:', err.message);
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  async function launchBot() {
    console.log('[Telegram] Calling bot.launch()...');
    botStatus = 'initializing';
    try {
      // Verify connection and credentials first
      const botInfo = await bot.telegram.getMe();
      console.log(`[Telegram] Bot authenticated as @${botInfo.username}`);

      // Stop previous instance if any
      try {
        await bot.stop();
      } catch (e) {}

      // Launch in the background (do not await, as it only resolves when stopped)
      bot.launch().catch(err => {
        botStatus = 'failed';
        botError = err.message || String(err);
        console.error('[Telegram] Background polling error:', err.message || err);
        setTimeout(launchBot, 15000);
      });

      botStatus = 'active';
      botError = null;
      console.log('[Telegram] ✅ Rocky Bridge active and polling.');
    } catch (err) {
      botStatus = 'failed';
      botError = err.message || String(err);
      console.error('[Telegram] Launch failed:', err.message || err);
      console.log('[Telegram] Retrying launch in 15 seconds...');
      setTimeout(launchBot, 15000);
    }
  }

  launchBot();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// ─── Push an update proactively to the user ──────────────────────────────
function sendTelegramUpdate(message) {
  if (!bot || !AUTHORIZED_USER_ID || botStatus !== 'active') return;
  const text = String(message || '').trim();
  if (!text) return;

  const chunks = splitChunks(text);
  chunks.reduce(
    (chain, chunk) => chain.then(() => bot.telegram.sendMessage(AUTHORIZED_USER_ID, chunk)),
    Promise.resolve()
  ).catch(err => console.error('[Telegram] sendTelegramUpdate failed:', err.message));
}

function getTelegramStatus() {
  return { status: botStatus, error: botError, tokenExists: !!process.env.TELEGRAM_BOT_TOKEN };
}

module.exports = { initTelegram, sendTelegramUpdate, getTelegramStatus };
