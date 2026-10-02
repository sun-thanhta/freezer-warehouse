import { expect, test } from "@playwright/test";
import { dayOffset, KHO, login, logout, openOrder, QUAN_LY, selectByText, shot } from "./e2e-helpers";

// Follows docs/03-demo/demo-script-for-client.md on a freshly seeded database (`npm run db:seed`).
test.describe.configure({ mode: "serial" });

test("login gate: pages redirect to /login, API answers 401", async ({ page, request }) => {
  await page.goto("/outbound");
  await expect(page).toHaveURL(/\/login\?next=%2Foutbound/);
  await shot(page, "01-login");
  expect((await request.get("/api/dashboard")).status()).toBe(401);
});

test("warehouse: dashboard + inbound inspection (deviation → 隔離, beef id)", async ({ page }) => {
  await login(page, KHO);
  await expect(page.getByText("Đơn xuất đang mở").locator("..")).toContainText("5");
  await shot(page, "02-dashboard");

  await page.goto("/inbound/new");
  await selectByText(page.getByLabel("Nhà cung cấp"), "SUP-01");
  await selectByText(page.getByLabel("Sản phẩm (SKU)"), "CHI-002");
  await page.getByLabel("Số lô (lot)").fill("E2E-YGT-1");
  await page.getByLabel("Ngày sản xuất").fill(dayOffset(-1));
  await page.getByLabel(/^Hạn dùng/).fill(dayOffset(14));
  await page.getByLabel(/^Số lượng/).fill("12");
  await page.getByLabel(/Nhiệt độ đo khi nhận/).fill("9"); // 冷蔵 0–5°C
  await expect(page.getByText(/Nhiệt độ ngoài ngưỡng — ghi chú xử lý/)).toBeVisible();
  await page.getByLabel(/ghi chú xử lý/).fill("Đo lại 8.7°C — chuyển 隔離 chờ QA");
  await selectByText(page.getByLabel("Vị trí 隔離 (-Q)"), "C-Q-01");
  await shot(page, "03-inbound-deviation-hold");
  await page.getByRole("button", { name: "Xác nhận kiểm & nhập kho" }).click();
  await expect(page).toHaveURL(/\/inbound\/[0-9a-f-]{36}$/);
  await expect(page.getByText("保留 → 隔離")).toBeVisible();
  await shot(page, "04-inbound-detail");

  // Beef id with 9 digits → business-review, never padded to 10 (BR-TRACE-02)
  await page.goto("/inbound/new");
  await selectByText(page.getByLabel("Nhà cung cấp"), "SUP-03");
  await selectByText(page.getByLabel("Sản phẩm (SKU)"), "CHI-001");
  await page.getByLabel("Số lô (lot)").fill("E2E-BEEF-1");
  await page.getByLabel("Ngày sản xuất").fill(dayOffset(-1));
  await page.getByLabel(/^Hạn dùng/).fill(dayOffset(5));
  await page.getByLabel(/^Số lượng/).fill("4");
  await page.getByLabel(/Nhiệt độ đo khi nhận/).fill("3");
  await selectByText(page.getByLabel("Vị trí lưu"), "C-01-01");
  await page.getByLabel(/Mã cá thể bò/).fill("140812345");
  await page.getByRole("button", { name: "Xác nhận kiểm & nhập kho" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "business-review" })).toBeVisible();
});

test("warehouse: FR-OUT-02 chain excludes window / band lots, shipment confirmed", async ({ page }) => {
  await login(page, KHO);
  await openOrder(page, "01");
  await expect(page.locator("tr", { hasText: "LOT-AMB001-A" })).toContainText("④ Quá delivery window");
  await expect(page.locator("tr", { hasText: "LOT-AMB001-B" })).toContainText("Đề xuất FEFO");
  await expect(page.locator("tr", { hasText: "LOT-FRO001-X" })).toContainText("② Sai dải nhiệt");
  await shot(page, "05-outbound-01");
  await page.getByLabel(/Nhiệt độ hàng khi xuất/).fill("-20"); // coldest band of the order = 冷凍
  await page.getByRole("button", { name: "Kiểm tra & xác nhận giao" }).click();
  await expect(page.getByText("Đã xác nhận giao.")).toBeVisible();
  await expect(page.getByText("Đã giao")).toBeVisible();
  await shot(page, "06-outbound-01-shipped");
});

test("warehouse: 日付逆転 pick blocked, then sent as a maker-checker request", async ({ page }) => {
  await login(page, KHO);
  await openOrder(page, "03");
  await expect(page.getByText(/Cảnh báo 日付逆転:/)).toBeVisible();
  await expect(page.locator("tr", { hasText: "LOT-CHI004-A" })).toContainText("③ Đang 隔離");
  await expect(page.getByText(/AGR-008 · 軒先渡し · chưa chốt/)).toBeVisible();
  await page.getByLabel("Số lượng lấy từ lô LOT-CHI002-A").fill("24");
  await page.getByLabel(/Nhiệt độ hàng khi xuất/).fill("-20");
  await page.getByRole("button", { name: "Xác nhận giao (có vi phạm 日付逆転)" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "CHẶN: vi phạm 日付逆転禁止" })).toBeVisible();
  await shot(page, "07-outbound-03-blocked");

  await page.getByLabel(/Lý do đề nghị ngoại lệ/).fill("Khách CUS-003 đồng ý bằng văn bản");
  await page.getByRole("button", { name: "Gửi đề nghị ngoại lệ" }).click();
  await expect(page.getByText(/Đã gửi đề nghị ngoại lệ/)).toBeVisible();
  await expect(page.getByText(/không được tự duyệt/)).toBeVisible();

  await page.goto("/alerts");
  await expect(page.locator("tr", { hasText: "CHI-002" }).filter({ hasText: "Bị chặn" })).toBeVisible();
  await expect(page.getByText("Chờ duyệt", { exact: true })).toBeVisible();
  await shot(page, "08-alerts");
});

test("manager (different person) approves the request → shipped and logged", async ({ page }) => {
  await login(page, QUAN_LY);
  await openOrder(page, "03");
  await expect(page.getByText(/Đề nghị ngoại lệ 日付逆転 đang chờ duyệt/)).toBeVisible();
  await expect(page.locator("li", { hasText: "LOT-CHI002-A" })).toContainText("vi phạm 日付逆転"); // checker sees what is approved
  await page.getByRole("button", { name: "Duyệt & giao hàng" }).click();
  await expect(page.getByText("Đã giao")).toBeVisible();
  await shot(page, "09-manager-approved");
  await page.goto("/alerts");
  await expect(page.getByText("Đã duyệt ngoại lệ").first()).toBeVisible();
  await expect(page.getByText(/Đã duyệt → giao/)).toBeVisible();
});

test("manager: agreement window, thresholds, 隔離 release; warehouse cannot", async ({ page }) => {
  await login(page, QUAN_LY);
  await page.goto("/customers");
  await page.getByLabel("Delivery window AGR-008").selectOption("ONE_HALF");
  await expect(page.getByText(/AGR-008: delivery window → 1\/2/)).toBeVisible();
  await page.goto("/settings");
  await page.getByLabel(/^Max 冷蔵/).fill("4");
  await page.locator("tr", { has: page.getByLabel(/^Max 冷蔵/) }).getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText(/Đã lưu ngưỡng 冷蔵/)).toBeVisible();
  await page.goto("/inventory?view=quarantine&zone=0");
  await page.getByLabel("Lý do xử lý LOT-CHI004-A").fill("QA đo lại 3.8°C — đạt");
  await page.getByLabel("Vị trí release LOT-CHI004-A").selectOption({ label: "C-03-01" });
  await page.locator("tr", { hasText: "LOT-CHI004-A" }).getByRole("button", { name: "Release" }).click();
  await expect(page.getByText(/LOT-CHI004-A: đã release/)).toBeVisible();
  await page.goto("/audit");
  await expect(page.getByText("quarantine.release").first()).toBeVisible();

  await logout(page);
  await login(page, KHO);
  await page.goto("/settings");
  await expect(page.getByLabel(/^Max 冷蔵/)).toBeDisabled();
  await page.goto("/customers");
  await expect(page.getByLabel("Delivery window AGR-014")).toBeDisabled();
});

test("traceability forward + mobile layout", async ({ page }) => {
  await login(page, KHO);
  await page.goto("/trace");
  await page.getByLabel("Số lô").fill("LOT-CHI001-A");
  await page.getByRole("button", { name: "Truy xuôi" }).click();
  await expect(page.getByRole("cell", { name: /みどり生協/ })).toBeVisible();
  await expect(page.getByText("1408123456").first()).toBeVisible();

  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("link", { name: /Cảnh báo 日付逆転/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(400);
  await shot(page, "10-mobile");
});
