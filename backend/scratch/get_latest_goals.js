const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.all("SELECT * FROM goals ORDER BY created_at DESC LIMIT 10", [], (err, goals) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("Goals:", JSON.stringify(goals, null, 2));
  db.close();
});
