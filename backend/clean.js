const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, './database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Connecting to: ', dbPath);

db.serialize(() => {
  db.run("DELETE FROM projects WHERE status IN ('running', 'partial', 'pending', 'failed')");
  db.run("DELETE FROM goals WHERE status IN ('running', 'partial', 'pending', 'failed')", (err) => {
    if (err) console.error(err);
    else console.log('Successfully wiped all stalled goals and projects from SQLite!');
  });
});
