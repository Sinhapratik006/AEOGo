const sqljs = require('sql.js');

sqljs({debug: false}).then(SQL => {
  const db = new SQL.Database();
  db.exec('CREATE TABLE test (id INT)');
  
  // Try export method
  try {
    const buf = db.export ? db.export() : null;
    console.log('db.export:', buf ? buf.length : 'not a function');
  } catch(e) {
    console.log('db.export error:', e.message);
  }
  
  // Try the Ya property
  try {
    console.log('Ya type:', typeof db.Ya, 'length:', db.Ya ? db.Ya.length : 'N/A');
  } catch(e) {
    console.log('Ya error:', e.message);
  }
  
  db.close();
});