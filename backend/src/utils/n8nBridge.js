const axios = require('axios');
const { log } = require('../notifications/notifier');

const N8N_BASE_URL = process.env.N8N_URL || 'http://localhost:5678';

async function triggerN8NWorkflow(webhookId, data) {
  try {
    log(null, null, `🔗 Triggering n8n Workflow: ${webhookId}`);
    const response = await axios.post(`${N8N_BASE_URL}/webhook/${webhookId}`, data);
    return response.data;
  } catch (error) {
    console.error(`❌ [n8n Bridge] Workflow ${webhookId} failed:`, error.message);
    throw error;
  }
}

module.exports = { triggerN8NWorkflow };
