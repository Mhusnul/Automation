import { test, expect, type Locator, type Page } from "@playwright/test";

function mainArea(page: Page): Locator {
  return page.getByRole("main");
}

function filterButton(page: Page, name: string): Locator {
  return page.getByRole("button", { name, exact: true });
}

function chartSection(page: Page, heading: string): Locator {
  return mainArea(page)
    .getByRole("heading", { name: heading, exact: true, level: 3 })
    .locator("xpath=../..");
}

async function readCountBesideLabel(
  root: Locator,
  label: string,
): Promise<number> {
  const value = root
    .getByText(label, { exact: true })
    .first()
    .locator("xpath=following-sibling::*[1]");
  await expect(value).toHaveText(/^\d+$/);
  return Number((await value.innerText()).trim());
}

async function readSectionTotal(page: Page, heading: string): Promise<number> {
  return readCountBesideLabel(chartSection(page, heading), "Total");
}

test.describe("Assets Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/assets/");
  });

  test("Assets Dashboard - Realtime operational status of equipment and rooms by location and category.", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/dashboard\/assets\//);
    await expect(
      page.getByRole("heading", { name: "Assets Dashboard", level: 1 }),
    ).toBeVisible();
    await expect(
      mainArea(page).getByText(
        "Realtime operational status of equipment and rooms by location and category.",
      ),
    ).toBeVisible();
  });

  test("Location, User Category", async ({ page }) => {
    await expect(filterButton(page, "Location")).toContainText("All Sites");
    await expect(filterButton(page, "User Category")).toContainText(
      "All Categories",
    );
  });

  test("Equipment - Operational Status · Realtime", async ({ page }) => {
    const equipment = chartSection(page, "Equipment");

    await expect(
      mainArea(page).getByRole("heading", {
        name: "Equipment",
        exact: true,
        level: 3,
      }),
    ).toBeVisible();
    await expect(equipment.getByText("Operational Status · Realtime")).toBeVisible();
    await expect(equipment.getByText("Total", { exact: true })).toBeVisible();
    await expect(equipment.getByText(/^\d+$/).first()).toBeVisible();
  });

  test("Room - Operational Status · Realtime", async ({ page }) => {
    const room = chartSection(page, "Room");

    await expect(
      mainArea(page).getByRole("heading", {
        name: "Room",
        exact: true,
        level: 3,
      }),
    ).toBeVisible();
    await expect(room.getByText("Operational Status · Realtime")).toBeVisible();
    await expect(room.getByText("Total", { exact: true })).toBeVisible();
    await expect(room.getByText(/^\d+$/).first()).toBeVisible();
  });

  test("Location", async ({ page }) => {
    await filterButton(page, "Location").click();
    await page.getByRole("option", { name: "SITE A (Plant A)" }).click();

    await expect(filterButton(page, "Location")).toContainText(
      "SITE A (Plant A)",
    );
    await expect(filterButton(page, "Clear Location")).toBeVisible();

    await filterButton(page, "Clear Location").click();
    await expect(filterButton(page, "Location")).toContainText("All Sites");
  });

  test("Equipment Total sama dengan Total Equipment di Equipment Management", async ({
    page,
  }) => {
    const dashboardTotal = await readSectionTotal(page, "Equipment");

    await page.goto("/equipment-management/");
    await expect(page).toHaveURL(/\/equipment-management\/$/);
    await expect(
      page.getByRole("heading", { name: "Equipment Management", level: 1 }),
    ).toBeVisible();

    expect(
      dashboardTotal,
      "Equipment Total di Assets Dashboard harus sama dengan Total Equipment",
    ).toBe(await readCountBesideLabel(mainArea(page), "Total Equipment"));
  });

  test("Room Total sama dengan Total Room di Room Management", async ({
    page,
  }) => {
    const dashboardTotal = await readSectionTotal(page, "Room");

    await page.goto("/room-management/");
    await expect(page).toHaveURL(/\/room-management\/$/);
    await expect(
      page.getByRole("heading", { name: "Room Management", level: 1 }),
    ).toBeVisible();

    expect(
      dashboardTotal,
      "Room Total di Assets Dashboard harus sama dengan Total Room",
    ).toBe(await readCountBesideLabel(mainArea(page), "Total Room"));
  });
});
