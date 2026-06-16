// testCrew.js
const { callCrewBrain } = require('./src/crew/crewBridge');
const { log } = require('./src/notifications/notifier');
require('dotenv').config();

// Mock the notifier log to stdout for this test
global.log = (id, pid, msg) => console.log(`[LOG] ${msg}`);

async function test() {
    console.log("🚀 STARTING CREWAI END-TO-END TEST...");
    const testGoal = "Plan a detailed documentation strategy for a React Native project";
    
    try {
        console.log(`\n--- Input Goal: "${testGoal}" ---\n`);
        
        // This will trigger the Python bridge logic
        const plan = await callCrewBrain(testGoal);
        
        console.log("\n--- TEST SUCCESSFUL ---");
        console.log("Response Summary:", plan.summary);
        console.log("Estimated Time:", plan.estimated_time);
        console.log("Number of steps generated:", plan.steps?.length || 0);
        console.log("\nFull JSON Payload:");
        console.log(JSON.stringify(plan, null, 2));
        
    } catch (err) {
        console.error("\n--- TEST FAILED ---");
        console.error("Error Detail:", err.message);
        if (err.stdout) console.error("Process Output:", err.stdout);
        if (err.stderr) console.error("Process Error:", err.stderr);
    }
}

test();
