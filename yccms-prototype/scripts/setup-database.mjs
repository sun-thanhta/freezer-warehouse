#!/usr/bin/env node
// One-shot Supabase setup for the YCCMS prototype:
//   1. apply schema + RPC migrations   (supabase/migrations/*.sql)
//   2. load the MOCK dataset            (supabase/seed/*.sql — wipes business tables)
//   3. create demo auth users + profiles (Supabase Admin API)
//
// Usage:  npm run db:setup            # full setup (safe to re-run)
//         npm run db:seed             # only reload mock data (reset the demo)
// Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), SUPABASE_DB_URL

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "YukiDemo#2026";
const DEMO_USERS = [
  { email: "kho@yuki-demo.jp", full_name: "佐藤 (Nhân viên kho)", role: "warehouse" },
  { email: "quanly@yuki-demo.jp", full_name: "田中 (Quản lý kho)", role: "manager" },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; // new sb_secret_… or legacy service_role
const dbUrl = process.env.SUPABASE_DB_URL;
const missing = Object.entries({ NEXT_PUBLIC_SUPABASE_URL: url, "SUPABASE_SECRET_KEY (hoặc SUPABASE_SERVICE_ROLE_KEY)": serviceKey, SUPABASE_DB_URL: dbUrl })
  .filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`✖ Thiếu biến môi trường: ${missing.join(", ")} (xem .env.example)`);
  process.exit(1);
}

const seedOnly = process.argv.includes("--seed-only");
const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl);
const db = new pg.Client({ connectionString: dbUrl, ssl: isLocal ? false : { rejectUnauthorized: false } });

async function runSqlDir(dir) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    process.stdout.write(`  · ${dir}/${file} … `);
    await db.query(readFileSync(join(dir, file), "utf8"));
    console.log("ok");
  }
}

async function ensureDemoUsers() {
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  for (const u of DEMO_USERS) {
    let user = list.users.find((x) => x.email === u.email);
    if (user) {
      const { error } = await admin.auth.admin.updateUserById(user.id, { password: DEMO_PASSWORD });
      if (error) throw error;
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: DEMO_PASSWORD, email_confirm: true });
      if (error) throw error;
      user = data.user;
    }
    await db.query(
      `insert into profiles (id, email, full_name, role) values ($1, $2, $3, $4)
       on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, role = excluded.role`,
      [user.id, u.email, u.full_name, u.role],
    );
    console.log(`  · ${u.email} (${u.role}) ok`);
  }
}

try {
  await db.connect();
  if (!seedOnly) {
    console.log("▸ Áp schema + hàm RPC");
    await runSqlDir("supabase/migrations");
  }
  console.log("▸ Nạp dữ liệu mock");
  await runSqlDir("supabase/seed");
  if (!seedOnly) {
    console.log("▸ Tạo tài khoản demo");
    await ensureDemoUsers();
  }
  console.log(`✔ Xong. Đăng nhập bằng ${DEMO_USERS.map((u) => u.email).join(" / ")} — mật khẩu: ${DEMO_PASSWORD}`);
} catch (err) {
  console.error("✖ Lỗi:", err.message ?? err);
  if (/ENOTFOUND|ECONNREFUSED|timeout|Tenant or user not found/i.test(String(err.message))) {
    console.error("  → Nếu project Supabase đang bị pause: vào Dashboard → Resume project, đợi 1–2 phút rồi chạy lại.");
  }
  process.exitCode = 1;
} finally {
  await db.end();
}
