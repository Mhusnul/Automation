import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/sign-in/");
  await page.getByRole("textbox", { name: "Email" }).fill("superadmin@mail.com");
  await page.getByRole("textbox", { name: "Password" }).fill("Pa$$w0rd");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL("**/dashboard/**");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
