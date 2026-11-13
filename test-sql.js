const sqljs = require('sql.js');

sqljs({debug: false}).then(SQL => {
  const db = new SQL.Database();
  db.exec('CREATE TABLE test (id INT)');
  console.log('Table created');
  
  // Try to export
  try {
    const content = db.exec("SELECT sql FROM sqlite_master WHERE type='table'");
    console.log('Meta:', JSON.stringify(content, null, 2));
  } catch(e) {
    console.log('Error:', e.message);
  }
  
  db.close();
  console.log('Done');
});