import { test, expect } from "@playwright/test";

test("example", async ({ page }) => {
  await page.goto("/dashboard/work-order/");

  await expect(
    page.getByRole("heading", { name: "Work Order Dashboard" }),
  ).toBeVisible();
});
