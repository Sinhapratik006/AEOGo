const sqljs = require('sql.js');

sqljs({debug: false}).then(SQL => {
  const db = new SQL.Database();
  
  // Apply the schema from aeo_audit.py
  const schema = `
CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, domain TEXT, started TEXT);
CREATE TABLE IF NOT EXISTS pages(run_id INT, url TEXT, status INT, title TEXT, description TEXT,
  h1_count INT, words INT, rendered_words INT, schema_types TEXT, text_excerpt TEXT);
CREATE TABLE IF NOT EXISTS issues(run_id INT, url TEXT, code TEXT, severity TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS drafts(id INTEGER PRIMARY KEY, run_id INT, url TEXT, field TEXT,
  proposed TEXT, rationale TEXT, status TEXT DEFAULT 'draft', created TEXT);
`;
  db.exec(schema);
  
  // Verify tables
  const tables = db.exec("SELECT name, type FROM sqlite_master WHERE type='table'");
  console.log('Tables in aeo.db:');
  tables[0].values.flat().forEach(row => {
    console.log(' -', row[0], '(type:', row[1] + ')');
  });
  
  // Also check the schema
  const schemaData = db.exec("SELECT sql FROM sqlite_master");
  console.log('\\nSchema statements:');
  schemaData[0].values.flat().forEach(row => {
    console.log(' -', row[0]);
  });
  
  db.close();
}).catch(err => {
  console.error('Error:', err);
});