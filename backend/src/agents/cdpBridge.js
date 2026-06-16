const http = require('http');
const WebSocket = require('ws');

const PORTS = [9000, 9001, 9002, 9003, 9012, 9013, 9014, 9015];

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function discoverCDP() {
  const errors = [];
  for (const port of PORTS) {
    try {
      const list = await getJson(`http://127.0.0.1:${port}/json/list`);
      const workbench = list.find(
        t => t.url?.includes('workbench.html') || (t.title && t.title.includes('workbench'))
      );
      if (workbench && workbench.webSocketDebuggerUrl) {
        return workbench.webSocketDebuggerUrl;
      }
      const jetski = list.find(t => t.url?.includes('jetski') || t.title === 'Launchpad');
      if (jetski && jetski.webSocketDebuggerUrl) {
        return jetski.webSocketDebuggerUrl;
      }
    } catch (e) {
      errors.push(`${port}: ${e.message}`);
    }
  }
  throw new Error(`CDP not found. ${errors.join(', ')}`);
}

async function connectCDP(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  let idCounter = 1;
  const pending = new Map();
  const contexts = [];

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.id !== undefined && pending.has(data.id)) {
        const { resolve, reject, timer } = pending.get(data.id);
        clearTimeout(timer);
        pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
      if (data.method === 'Runtime.executionContextCreated') {
        contexts.push(data.params.context);
      } else if (data.method === 'Runtime.executionContextDestroyed') {
        const idx = contexts.findIndex(c => c.id === data.params.executionContextId);
        if (idx !== -1) contexts.splice(idx, 1);
      } else if (data.method === 'Runtime.executionContextsCleared') {
        contexts.length = 0;
      }
    } catch (e) {}
  });

  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = idCounter++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await call('Runtime.enable', {});
  await new Promise(r => setTimeout(r, 800));
  return { ws, call, contexts };
}

async function evalInContexts(cdp, expression) {
  for (const ctx of cdp.contexts) {
    try {
      const result = await cdp.call('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
        contextId: ctx.id,
      });
      if (result.exceptionDetails) continue;
      if (result.result && result.result.value !== undefined) {
        return result.result.value;
      }
    } catch (e) {}
  }
  return null;
}

async function injectMessage(cdp, text) {
  const safeText = JSON.stringify(text);
  const expr = `(async () => {
    const cancel = document.querySelector('[data-tooltip-id="input-send-button-cancel-tooltip"]');
    const isBusy = (() => {
      if (!cancel) return false;
      if (cancel.offsetParent === null) return false;
      const style = window.getComputedStyle(cancel);
      return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0 && cancel.getBoundingClientRect().width > 0;
    })();
    if (isBusy) return { ok: false, reason: 'busy' };

    const editors = [
      ...document.querySelectorAll(
        '#conversation [contenteditable="true"], #chat [contenteditable="true"], #cascade [contenteditable="true"]'
      ),
    ].filter(el => el.offsetParent !== null);
    const editor = editors.at(-1);
    if (!editor) return { ok: false, error: 'editor_not_found' };

    const textToInsert = ${safeText};
    editor.focus();
    document.execCommand?.('selectAll', false, null);
    document.execCommand?.('delete', false, null);

    let inserted = false;
    try { inserted = !!document.execCommand?.('insertText', false, textToInsert); } catch {}
    if (!inserted) {
      editor.textContent = textToInsert;
      editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: textToInsert }));
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: textToInsert }));
    }

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const btn = document.querySelector('svg.lucide-arrow-right')?.closest('button');
    if (btn && !btn.disabled) { btn.click(); return { ok: true, method: 'click_submit' }; }

    editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter' }));
    editor.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter' }));
    return { ok: true, method: 'enter_keypress' };
  })()`;
  return evalInContexts(cdp, expr);
}

async function readLatestResponse(cdp) {
  const expr = `(async () => {
    const cancelBtn = document.querySelector('[data-tooltip-id="input-send-button-cancel-tooltip"]');
    const isGenerating = (() => {
      if (!cancelBtn) return false;
      if (cancelBtn.offsetParent === null) return false;
      const style = window.getComputedStyle(cancelBtn);
      return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0 && cancelBtn.getBoundingClientRect().width > 0;
    })();

    let lastText = '';
    const agentNodes = document.querySelectorAll(
      '[role="article"][aria-label="Agent response"], [data-message-author-role="assistant"], .agent-turn'
    );

    if (agentNodes.length > 0) {
      const lastAgentNode = agentNodes[agentNodes.length - 1];
      let textNode = lastAgentNode.querySelector('.leading-relaxed, .prose, .response-text');
      
      if (!textNode) textNode = lastAgentNode;
      
      lastText = (textNode.innerText || '').trim();
      if (!lastText) {
        lastText = (textNode.textContent || '').trim();
      }
      
      // Filter out markdown-alert CSS if textContent caught it
      if (lastText.includes('/* Copied from remark-github-blockquote-alert')) {
         const parts = lastText.split('</style>');
         if (parts.length > 1) lastText = parts.slice(1).join('</style>').trim();
      }
    }

    return { status: isGenerating ? 'generating' : 'idle', text: lastText };
  })()`;
  return evalInContexts(cdp, expr);
}

module.exports = { discoverCDP, connectCDP, injectMessage, readLatestResponse };
