const execa = require('execa');
const path = require('path');
const { log } = require('../notifications/notifier');

/**
 * Calls the CrewAI Python brain to generate a strategy for a complex goal.
 * @param {string} goal - The user's goal description.
 * @returns {Promise<Object>} - The parsed JSON strategy from the Crew.
 */
async function callCrewBrain(goal) {
    const bridgePath = path.join(__dirname, 'bridge.py');
    const pythonPath = process.platform === 'win32' 
        ? path.join(__dirname, '..', '..', 'venv', 'Scripts', 'python.exe')
        : path.join(__dirname, '..', '..', 'venv', 'bin', 'python');

    log('system', null, `🧠 Consulting the CrewAI Brain for: "${goal.substring(0, 50)}..."`);

    try {
        const { stdout } = await execa(pythonPath, [bridgePath, goal], {
            cwd: __dirname,
            timeout: 60000 // 60s timeout for complex reasoning
        });

        // The bridge outputs the raw result. We try to find the JSON block.
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return {
            summary: "Crew completed the strategy but failed to format as JSON.",
            raw: stdout
        };
    } catch (error) {
        log('system', null, `❌ CrewAI Brain Error: ${error.message}`);
        throw error;
    }
}

module.exports = { callCrewBrain };
