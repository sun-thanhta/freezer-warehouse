import { expect, type Locator, type Page } from "@playwright/test";

export const PASSWORD = process.env.DEMO_PASSWORD ?? "YukiDemo#2026";
export const KHO = "kho@yuki-demo.jp";
export const QUAN_LY = "quanly@yuki-demo.jp";
/** Optional folder for demo screenshots (e.g. the plan's evidence dir). */
const SHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Tổng quan vận hành" })).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Selects the first <option> whose text contains `text`. */
export async function selectByText(select: Locator, text: string) {
  const label = await select.locator("option", { hasText: text }).first().textContent();
  await select.selectOption({ label: label ?? text });
}

export async function openOrder(page: Page, suffix: string) {
  await page.goto("/outbound");
  await page.getByRole("link", { name: new RegExp(`^OUT-\\d{6}-${suffix}$`) }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Đơn xuất OUT-\\d{6}-${suffix}`) })).toBeVisible();
}

export function dayOffset(days: number): string {
  const jst = new Date(Date.now() + 9 * 3_600_000 + days * 86_400_000);
  return jst.toISOString().slice(0, 10);
}

export async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
}
