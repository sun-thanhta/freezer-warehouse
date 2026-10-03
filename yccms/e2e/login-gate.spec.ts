import { expect, test } from "@playwright/test";

const PASSWORD = process.env.DEV_PASSWORD ?? "YccmsDev#2026";

test("strangers are sent to /login and the API answers 401", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  const res = await request.get("/api/me");
  expect(res.status()).toBe(401);
});

test("a provisioned user signs in, sees their roles, and returns to ?next=", async ({ page }) => {
  await page.goto("/login?next=%2F");
  await page.getByLabel("Email").fill("quanly@yccms.local");
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByText("quanly@yccms.local", { exact: true })).toBeVisible();
  await expect(page.getByText("manager", { exact: true })).toBeVisible();
});

test("wrong password shows an error and stays on /login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("kho@yccms.local");
  await page.getByLabel("Mật khẩu").fill("wrong-password");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Sai email hoặc mật khẩu.");
  await expect(page).toHaveURL(/\/login/);
});
