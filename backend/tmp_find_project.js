const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

const query = `
  SELECT * FROM projects 
  WHERE name LIKE '%email%' 
     OR name LIKE '%apply%' 
     OR description LIKE '%email%' 
     OR description LIKE '%apply%'
     OR name LIKE '%job%'
     OR description LIKE '%job%'
`;

db.all(query, [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("Matching Projects:");
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
