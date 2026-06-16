const modelRouter = require('../../models/modelRouter');
const { log } = require('../../notifications/notifier');

async function plannerNode(state) {
  log(null, null, `[Graph:Planner] Designing strategy for: ${state.objective}`);
  
  const prompt = `You are the Rocky Strategic Planner.
Your goal is to break down a high-level development objective into a clear, technical, step-by-step plan.
Objective: ${state.objective}

Provide a JSON array of steps. Each step should have:
- title: Short description
- description: Technical details
- type: 'code' | 'command' | 'verify'

Format: Only return the JSON array.`;

  const response = await modelRouter.call([{ role: 'user', content: prompt }]);
  
  let plan = [];
  try {
    // Clean up potential markdown formatting from LLM
    const cleaned = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
    plan = JSON.parse(cleaned);
  } catch (err) {
    console.error('[PlannerNode] Failed to parse plan:', err);
    plan = [{ title: 'Direct Implementation', description: state.objective, type: 'code' }];
  }

  return { 
    plan,
    status: 'coding'
  };
}

module.exports = plannerNode;
