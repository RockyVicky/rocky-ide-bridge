const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.all("SELECT * FROM goals ORDER BY created_at DESC LIMIT 5", [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("Latest Goals:");
  console.log(JSON.stringify(rows, null, 2));
  
  db.all("SELECT * FROM projects ORDER BY created_at DESC LIMIT 5", [], (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log("\nLatest Projects:");
    console.log(JSON.stringify(rows, null, 2));
    db.close();
  });
});
