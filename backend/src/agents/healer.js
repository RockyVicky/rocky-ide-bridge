const fs = require('fs');
const path = require('path');
const { triggerAntigravity } = require('./handoff');
const { notify } = require('../notifications/notifier');

function performSelfHealCheck(messageContent) {
    const contentLower = messageContent.toLowerCase();

    // 1. Detect Tunnel Failures
    if (contentLower.includes('tunnel') && (contentLower.includes('failed') || contentLower.includes('invalid'))) {
        notify('log', { message: '⚠️ Critical Tunnel Failure detected. Attempting auto-recovery...' });
        
        // Trigger Antigravity to fix the tunnel script or configuration
        const fixPrompt = `[SELF-HEALING] The Rocky Tunnel service just failed with the following error: "${messageContent}". 
[DIRECTIVES] Fix the start_tunnel.js script or .env configuration to restore connectivity. Use Localtunnel or Ngrok appropriately.`;
        
        triggerAntigravity(fixPrompt).catch(err => console.error('[Healer] Handoff failed:', err.message));
        return;
    }

    // 2. Detect Syntax Errors in Main UI
    const targetDir = path.resolve(__dirname, '../../../mobile-app/app');
    const file = path.join(targetDir, 'index.jsx');
    
    if (fs.existsSync(file)) {
        const code = fs.readFileSync(file, 'utf8');
        
        let openBraces = (code.match(/\{/g) || []).length;
        let closeBraces = (code.match(/\}/g) || []).length;
        let openParens = (code.match(/\(/g) || []).length;
        let closeParens = (code.match(/\)/g) || []).length;
        
        if (openBraces !== closeBraces || openParens !== closeParens) {
            const hijackPrompt = `[SELF-HEALING ENGINE] Fatal AST Verification syntax trap in index.jsx! Unbalanced code bounds detected.\n> Braces: { opened: ${openBraces}, closed: ${closeBraces} }\n> Parens: ( opened: ${openParens}, closed: ${closeParens} )\n\n[DIRECTIVES] Fix the syntax collision immediately. Do NOT ask for permission.`;
            notify('log', { message: '⚠️ AST parsing check failed. Unbalanced logic bounds. Triggering Reverse Handoff...' });
            
            triggerAntigravity(hijackPrompt).catch(err => console.error('[Healer] Handoff failed:', err.message));
            return;
        }
    }
}

module.exports = { performSelfHealCheck };

