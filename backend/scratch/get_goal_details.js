const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.get("SELECT * FROM goals WHERE id = '2c6528d0-bf9c-44f3-9546-efeee6880577'", [], (err, goal) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("Goal:", goal);
  db.close();
});
