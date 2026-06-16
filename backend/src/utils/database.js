const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    status TEXT,
    estimated_time TEXT,
    progress INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, () => {
    // Attempt to add columns if table already exists (will fail silently if already present)
    db.run("ALTER TABLE goals ADD COLUMN estimated_time TEXT", () => {});
    db.run("ALTER TABLE goals ADD COLUMN progress INTEGER DEFAULT 0", () => {});
  });

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    goal_id TEXT,
    name TEXT,
    description TEXT,
    status TEXT,
    code TEXT,
    output TEXT,
    error TEXT,
    retries INTEGER DEFAULT 0,
    model_used TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(goal_id) REFERENCES goals(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    goal_id TEXT,
    level TEXT,
    message TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS system_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

function createGoal(id, title, description) {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO goals (id, title, description, status) VALUES (?, ?, ?, 'pending')", 
      [id, title, description], function(err) {
      if (err) reject(err); else resolve();
    });
  });
}

function updateGoalStatus(status, id) {
  return new Promise((resolve, reject) => {
    db.run("UPDATE goals SET status = ? WHERE id = ?", [status, id], function(err) {
      if (err) reject(err); else resolve();
    });
  });
}

function updateGoalProgress(id, progress, estimated_time = null) {
  return new Promise((resolve, reject) => {
    let query = "UPDATE goals SET progress = ?";
    let params = [progress];
    if (estimated_time) {
      query += ", estimated_time = ?";
      params.push(estimated_time);
    }
    query += " WHERE id = ?";
    params.push(id);

    db.run(query, params, function(err) {
      if (err) reject(err); else resolve();
    });
  });
}

function createProject(id, goal_id, name, description) {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO projects (id, goal_id, name, description, status) VALUES (?, ?, ?, ?, 'pending')", 
      [id, goal_id, name, description], function(err) {
      if (err) reject(err); else resolve();
    });
  });
}

function updateProject(status, code, output, error, retries, model_used, id) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE projects SET status = ?, code = ?, output = ?, error = ?, retries = ?, model_used = ? WHERE id = ?`, 
      [status, code, output, error, retries, model_used, id], function(err) {
      if (err) reject(err); else resolve();
    });
  });
}

function addLog(project_id, goal_id, level, message, details) {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO logs (project_id, goal_id, level, message, details) VALUES (?, ?, ?, ?, ?)", 
      [project_id, goal_id, level, message, details], function(err) {
      if (err) reject(err); else resolve();
    });
  });
}

function getGoals() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM goals ORDER BY created_at DESC", [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function getGoalById(goalId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM goals WHERE id = ?", [goalId], (err, row) => {
      if (err) reject(err); else resolve(row || null);
    });
  });
}

function getProjectsByGoal(goalId) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM projects WHERE goal_id = ? ORDER BY created_at ASC", [goalId], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function getLogsByGoal(goalId, limit = 200) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM logs WHERE goal_id = ? ORDER BY created_at DESC LIMIT ?",
      [goalId, limit],
      (err, rows) => {
        if (err) reject(err); else resolve(rows);
      }
    );
  });
}

function getLogs(limit = 100) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM logs ORDER BY created_at DESC LIMIT ?", [limit], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function recoverStaleExecutions(staleMinutes = 30) {
  return new Promise((resolve, reject) => {
    const staleWindow = `-${Math.max(Number(staleMinutes) || 30, 1)} minutes`;

    db.serialize(() => {
      db.all(
        `
        SELECT id
        FROM goals
        WHERE status IN ('planning', 'running')
          AND COALESCE(
            (
              SELECT MAX(created_at)
              FROM logs
              WHERE logs.goal_id = goals.id
            ),
            goals.created_at
          ) <= DATETIME('now', ?)
        `,
        [staleWindow],
        (err, rows) => {
          if (err) return reject(err);
          if (!rows.length) return resolve({ recoveredGoals: 0, recoveredProjects: 0 });

          const goalIds = rows.map((row) => row.id);
          const placeholders = goalIds.map(() => '?').join(', ');
          const reason = `Recovered from stale execution after ${Math.max(Number(staleMinutes) || 30, 1)} minutes without activity.`;

          db.run(
            `UPDATE goals SET status = 'failed' WHERE id IN (${placeholders})`,
            goalIds,
            function(goalErr) {
              if (goalErr) return reject(goalErr);

              db.run(
                `UPDATE projects
                 SET status = 'failed',
                     error = COALESCE(NULLIF(error, ''), ?)
                 WHERE goal_id IN (${placeholders})
                   AND status IN ('pending', 'running')`,
                [reason, ...goalIds],
                function(projectErr) {
                  if (projectErr) return reject(projectErr);
                  resolve({ recoveredGoals: goalIds.length, recoveredProjects: this.changes });
                }
              );
            }
          );
        }
      );
    });
  });
}

function addMemory(prompt, result) {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO system_memory (prompt, result) VALUES (?, ?)", [prompt, result], (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

function getMemoryContext(limit = 3) {
  return new Promise((resolve, reject) => {
    db.all("SELECT prompt, result FROM system_memory ORDER BY created_at DESC LIMIT ?", [limit], (err, rows) => {
      if (err) reject(err); else resolve(rows.reverse());
    });
  });
}

module.exports = {
  createGoal, updateGoalStatus, updateGoalProgress, createProject, updateProject, addLog, getGoals, getGoalById, getProjectsByGoal, getLogsByGoal, getLogs, recoverStaleExecutions, addMemory, getMemoryContext, db
};
