const fs = require('node:fs');
const path = require('node:path');

const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const files = ['.env.' + mode + '.local', '.env.local', '.env.' + mode, '.env'];
for (const file of files) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, 'utf8');
  const parsed = content.split('\n').reduce((acc, line) => {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();
      acc[key] = value;
    }
    return acc;
  }, {});
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
console.log('DATABASE_URL loaded, length:', dbUrl.length);

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { users } = require('../src/db/schema');

const pool = new Pool({
  connectionString: dbUrl,
  connectionTimeoutMillis: 10000,
});

const db = drizzle({ client: pool, schema: { users } });

const password = 'Demo1234!';
const passwordHash = require('node:crypto').createHash('sha256').update(password).digest('hex');

async function main() {
  try {
    const [user] = await db.insert(users).values({
      email: 'demo@aeogo.com',
      name: 'Demo User',
      passwordHash,
    }).returning();
    
    console.log('✅ Demo user created!');
    console.log(' Email:', user.email);
    console.log(' Name:', user.name);
    console.log(' Password:', password);
    console.log(' Password hash:', passwordHash);
  } catch (err) {
    console.error('❌ Error creating user:', err);
  } finally {
    await pool.end();
  }
}

main();