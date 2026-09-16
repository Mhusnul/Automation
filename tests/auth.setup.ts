import { test as setup, expect } from "@playwright/test";
import path from "path";
import "dotenv/config";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");
const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

if (!username || !password) {
  throw new Error("E2E_USERNAME and E2E_PASSWORD must be set in .env");
}

setup("authenticate", async ({ page }) => {
  await page.goto("/sign-in/");
  await page.getByRole("textbox", { name: "Email" }).fill(username);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL("**/dashboard/**");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
