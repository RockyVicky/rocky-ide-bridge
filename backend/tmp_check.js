const db = require('./src/utils/database.js');
const fs = require('fs');

async function check() {
  const goals = await db.getGoals();
  const latestGoal = goals[0];
  
  const projects = await db.getProjectsByGoal(latestGoal.id);
  const logs = await db.getLogs(50);
  
  const report = JSON.stringify({
    latestGoal,
    projects,
    recentLogs: logs.filter(l => l.goal_id === latestGoal.id)
  }, null, 2);
  
  fs.writeFileSync('tmp_log.txt', report);
}

check();
