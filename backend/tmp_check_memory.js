const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("Tables:");
  console.log(rows);
  
  if (rows.find(r => r.name === 'memory')) {
    db.all("SELECT * FROM memory ORDER BY created_at DESC LIMIT 5", [], (err, rows) => {
      if (err) console.error(err);
      else {
        console.log("\nMemory:");
        console.log(JSON.stringify(rows, null, 2));
      }
      db.close();
    });
  } else {
    console.log("\nNo 'memory' table found.");
    db.close();
  }
});
