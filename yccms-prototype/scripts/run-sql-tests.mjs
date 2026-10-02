#!/usr/bin/env node
// Runs supabase/tests/*.sql against SUPABASE_DB_URL (each file rolls back). `npm run db:test`
import { readdirSync, readFileSync, existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) { console.error("✖ Thiếu SUPABASE_DB_URL"); process.exit(1); }

const db = new pg.Client({ connectionString: dbUrl, ssl: /localhost|127\.0\.0\.1/.test(dbUrl) ? false : { rejectUnauthorized: false } });
db.on("notice", (n) => console.log(`  ${n.message}`));
try {
  await db.connect();
  for (const file of readdirSync("supabase/tests").filter((f) => f.endsWith(".sql")).sort()) {
    console.log(`▸ ${file}`);
    await db.query(readFileSync(`supabase/tests/${file}`, "utf8"));
  }
  console.log("✔ SQL tests passed");
} catch (err) {
  console.error("✖", err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
