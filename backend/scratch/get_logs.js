const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('database.sqlite');
const output = {};

db.all("SELECT * FROM goals WHERE created_at LIKE '2026-06-01%' ORDER BY created_at DESC", [], (err, goals) => {
  if (err) {
    console.error(err);
    return;
  }
  output.goals = goals;
  
  db.all("SELECT * FROM projects WHERE created_at LIKE '2026-06-01%' ORDER BY created_at DESC", [], (err, projects) => {
    if (err) {
      console.error(err);
      return;
    }
    output.projects = projects;
    
    db.all("SELECT * FROM logs WHERE created_at LIKE '2026-06-01%' ORDER BY created_at DESC LIMIT 50", [], (err, logs) => {
      if (err) {
        console.error(err);
        return;
      }
      output.logs = logs;
      
      fs.writeFileSync('scratch/db_dump.json', JSON.stringify(output, null, 2), 'utf8');
      console.log("DB dump saved to scratch/db_dump.json");
      db.close();
    });
  });
});
