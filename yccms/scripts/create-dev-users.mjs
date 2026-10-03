#!/usr/bin/env node
// Creates (or resets) LOCAL development accounts: auth user + app_users + user_roles.
// Refuses to run against anything that is not a local Supabase URL.
// Usage: npm run db:users   (also part of `npm run db:reset`)

import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("✖ Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY — chạy `npm run env:local` trước.");
  process.exit(1);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(url)) {
  console.error(`✖ Script này chỉ dành cho Supabase local, không chạy với ${url}.`);
  process.exit(1);
}

const PASSWORD = process.env.DEV_PASSWORD ?? "YccmsDev#2026";
const USERS = [
  { email: "kho@yccms.local", full_name: "佐藤 (Nhân viên kho)", roles: ["warehouse"] },
  { email: "quanly@yccms.local", full_name: "田中 (Quản lý kho)", roles: ["warehouse", "manager"] },
  { email: "quanly2@yccms.local", full_name: "鈴木 (Quản lý kho 2)", roles: ["warehouse", "manager"] },
  { email: "qa@yccms.local", full_name: "高橋 (QA)", roles: ["qa"] },
  { email: "admin@yccms.local", full_name: "伊藤 (Admin)", roles: ["admin"] },
];

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const fail = (error, what) => { if (error) { console.error(`✖ ${what}:`, error.message); process.exit(1); } };

const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
fail(listError, "Đọc danh sách user");

for (const u of USERS) {
  let user = list.users.find((x) => x.email === u.email);
  if (user) {
    fail((await admin.auth.admin.updateUserById(user.id, { password: PASSWORD })).error, `Đặt lại mật khẩu ${u.email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true });
    fail(error, `Tạo ${u.email}`);
    user = data.user;
  }
  fail((await admin.from("app_users").upsert({ id: user.id, email: u.email, full_name: u.full_name, is_active: true })).error, `Hồ sơ ${u.email}`);
  fail((await admin.from("user_roles").delete().eq("user_id", user.id)).error, `Xóa vai trò cũ ${u.email}`);
  fail((await admin.from("user_roles").insert(u.roles.map((role_code) => ({ user_id: user.id, role_code })))).error, `Gán vai trò ${u.email}`);
  console.log(`  · ${u.email} (${u.roles.join(", ")})`);
}
console.log(`✔ Tài khoản dev sẵn sàng — mật khẩu: ${PASSWORD}`);
