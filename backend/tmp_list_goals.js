const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.all("SELECT * FROM goals WHERE created_at > '2026-04-14' ORDER BY created_at DESC", [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
