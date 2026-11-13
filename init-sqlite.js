const sqljs = require('sql.js');
const fs = require('fs');

const schema = `
CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, domain TEXT, started TEXT);
CREATE TABLE IF NOT EXISTS pages(run_id INT, url TEXT, status INT, title TEXT, description TEXT,
  h1_count INT, words INT, rendered_words INT, schema_types TEXT, text_excerpt TEXT);
CREATE TABLE IF NOT EXISTS issues(run_id INT, url TEXT, code TEXT, severity TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS drafts(id INTEGER PRIMARY KEY, run_id INT, url TEXT, field TEXT,
  proposed TEXT, rationale TEXT, status TEXT DEFAULT 'draft', created TEXT);
`;

sqljs({debug: false}).then(SQL => {
  const db = new SQL.Database();
  
  // Apply the schema from aeo_audit.py
  db.exec(schema);
  console.log('Schema applied successfully');
  
  // Verify tables
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables created:');
  tables[0].values.flat().forEach(row => {
    console.log(' -', row[0]);
  });
  
  // Export as Buffer and write to file
  const buf = db.export();
  fs.writeFileSync('aeo.db', new Uint8Array(buf));
  console.log('aeo.db written, size:', buf.byteLength, 'bytes');
  
  db.close();
  console.log('Done.');
}).catch(err => {
  console.error('Error:', err);
});