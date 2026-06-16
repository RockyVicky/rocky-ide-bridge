```javascript
const { Pool } = require('pg');

const pool = new Pool({
  user: 'your_db_user',
  host: 'your_db_host',
  database: 'your_db_name',
  password: 'your_db_password',
  port: 5432,
});

async function deletePartialRecords() {
  try {
    await pool.query('DELETE FROM your_table WHERE condition');
    console.log('Partial records deleted successfully.');
  } catch (error) {
    console.error('Error deleting partial records:', error);
  } finally {
    await pool.end();
  }
}

deletePartialRecords();