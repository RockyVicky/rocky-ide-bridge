// verifyIntel.js
const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:3001/api';

async function test() {
    console.log("🚀 TRIGGERING INTEL VERIFICATION TASK...");
    
    try {
        const response = await axios.post(`${API_BASE}/goals`, {
            title: "Verification Goal [INTEL TEST]",
            description: "A simple task to verify the Intel Feed captures the final summary correctly."
        });
        
        console.log("✅ Goal Created Successfully!");
        console.log("Goal ID:", response.data.goalId);
        console.log("\nMonitor your Mobile App's Intel tab. You should see:");
        console.log("1. ✅ CrewAI Plan Received...");
        console.log("2. SYSTEM PROTOCOL: Goal Execution Finalized...");
        
    } catch (err) {
        console.error("❌ Failed to trigger goal:", err.message);
        if (err.response) console.error("Response data:", err.response.data);
    }
}

test();
