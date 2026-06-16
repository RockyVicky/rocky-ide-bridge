const { addLog } = require('../utils/database');
let ioServer = null;

// Preserve original console methods
const originalLog = console.log;
const originalError = console.error;

function initNotifier(io) {
  ioServer = io;

  // Intercept all system logs
  console.log = (...args) => {
    const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
    originalLog.apply(console, args);
    broadcastSystemLog('info', message);
  };

  console.error = (...args) => {
    const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
    originalError.apply(console, args);
    broadcastSystemLog('error', message);
  };
}

function broadcastSystemLog(level, message) {
  if (ioServer) {
    ioServer.emit('system_log', { level, message, ts: Date.now() });
    
    // Check for critical failures to trigger healer
    if (level === 'error' || message.toLowerCase().includes('failed') || message.toLowerCase().includes('fatal')) {
       try {
         const { performSelfHealCheck } = require('../agents/healer');
         performSelfHealCheck(message);
       } catch (e) {
         originalError('[Watchdog Error]', e.message);
       }
    }
  }
}

function notify(event, data) {
  if (ioServer) {
    ioServer.emit('activity', { ...data, event, ts: Date.now() });
    originalLog(`[NOTIFY: ${event}]`, data.message || '');
    
    // Bridge critical activity to Telegram
    if (event === 'goal_complete' || event === 'project_done' || event === 'project_error') {
       try {
         const { sendTelegramUpdate } = require('./telegram');
         sendTelegramUpdate(`🔔 *${event.toUpperCase()}*\n${data.message}`);
       } catch (e) { /* ignore */ }
    }
  }
}

function log(goalId, projectId, message) {
  originalLog(`[LOG]`, message);
  notify('log', { goalId, projectId, message });
  
  // Forward important logs to Telegram if they look like progress or reasoning
  if (message.includes('✅') || message.includes('🚀') || message.includes('Done') || message.includes('🧠') || message.includes('🎯')) {
     try {
       const { sendTelegramUpdate } = require('./telegram');
       sendTelegramUpdate(message);
     } catch (e) { /* ignore */ }
  }

  if (goalId) {
    addLog(projectId || 'goal-meta', goalId, 'info', message, '').catch(() => {});
  }
}

module.exports = { initNotifier, notify, log };

