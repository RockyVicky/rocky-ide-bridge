require('dotenv').config();
const modelRouter = require('./src/models/modelRouter');

async function testGodMode() {
  console.log("==================================================");
  console.log("🚀 STARTING GOD MODE INTELLIGENCE TEST");
  console.log("==================================================\n");

  const tasks = [
    { name: "Architectural Reasoning", prompt: "Design a high-level architecture for a real-time fleet tracking system using WebSockets and Redis." },
    { name: "Code Optimization", prompt: "Refactor this hypothetical function for O(n) complexity: for(i=0; i<n; i++) { for(j=0; j<n; j++) { ... } }" },
    { name: "Creative Strategy", prompt: "Generate 3 unique marketing slogans for an autonomous AI developer tool named 'Rocky'." }
  ];

  for (const task of tasks) {
    console.log(`[Task] Testing: ${task.name}...`);
    try {
      const start = Date.now();
      const result = await modelRouter.call([{ role: 'user', content: task.prompt }]);
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      
      console.log(`[Result] Success!`);
      console.log(`[Model] Used: ${result.modelName} (${result.modelUsed})`);
      console.log(`[Time] ${duration}s`);
      console.log(`[Snippet] ${result.content.substring(0, 100).replace(/\n/g, ' ')}...\n`);
    } catch (err) {
      console.error(`[Error] Task ${task.name} failed:`, err.response?.data || err.message);
    }
  }

  console.log("==================================================");
  console.log("📊 FINAL USAGE REPORT");
  console.log(JSON.stringify(modelRouter.getStats(), null, 2));
  console.log("==================================================");
}

testGodMode();
