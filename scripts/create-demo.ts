import { randomBytes, scrypt } from "node:crypto";
import { Pool } from "pg";

const N = 32_768;
const R = 8;
const P = 3;
const KEY_LENGTH = 64;
const MAX_MEMORY = 128 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, { N, r: R, p: P, maxmem: MAX_MEMORY }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

function hashPassword(password: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const salt = randomBytes(16);
      const key = await deriveKey(password, salt, KEY_LENGTH);
      resolve(`scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`);
    } catch (err) {
      reject(err);
    }
  });
}

const DEMO_EMAIL = "demo@aeogo.com";
const DEMO_PASSWORD = "Demo1234!";
const DEMO_NAME = "Demo User";

async function main() {
  const url =
    "postgresql://neondb_owner:npg_r8bpm3TfsPgl@ep-bitter-union-b45vlcyo-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10000 });

  try {
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    const { rows } = await pool.query(
      `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, now(), now())
       ON CONFLICT (email) DO UPDATE SET name = $2, password_hash = $3, updated_at = now()
       RETURNING id, email, name`,
      [DEMO_EMAIL, DEMO_NAME, passwordHash]
    );

    const user = rows[0];
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(" DEMO ACCOUNT CREATED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(" Email:   ", user.email);
    console.log(" Password:", DEMO_PASSWORD);
    console.log(" Name:    ", user.name);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Go to http://localhost:3000/login and sign in with the credentials above.");
    console.log("You'll be redirected to /dashboard after signing in.");
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
