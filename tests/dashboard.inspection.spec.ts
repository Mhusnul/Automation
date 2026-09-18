import { test, expect, type Locator, type Page } from "@playwright/test";

const STATUS_CARDS = [
  "Open",
  "Ready To Work",
  "In Progress",
  "Closed",
  "Overdue",
] as const;

const SUMMARY_STATUSES = [
  "Open",
  "Ready To Work",
  "In Progress",
  "Closed",
] as const;

function mainArea(page: Page): Locator {
  return page.getByRole("main");
}

function filterButton(page: Page, name: string): Locator {
  return page.getByRole("button", { name, exact: true });
}

function chartSection(page: Page, heading: string): Locator {
  return page
    .getByRole("heading", { name: heading, exact: true, level: 3 })
    .locator("xpath=../..");
}

function countBesideLabel(page: Page, label: string): Locator {
  return mainArea(page)
    .getByText(label, { exact: true })
    .first()
    .locator("xpath=following-sibling::*[1]");
}

async function readCountBesideLabel(page: Page, label: string): Promise<number> {
  const value = countBesideLabel(page, label);
  await expect(value).toHaveText(/^\d+$/);
  return Number((await value.innerText()).trim());
}

test.describe("Inspection Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/inspection/");
  });

  test("Inspection Dashboard - Overview of inspections by period, location, and category.", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/dashboard\/inspection\//);
    await expect(
      page.getByRole("heading", { name: "Inspection Dashboard", level: 1 }),
    ).toBeVisible();
    await expect(
      mainArea(page).getByText(
        "Overview of inspections by period, location, and category.",
      ),
    ).toBeVisible();
  });

  test("Period, Location, User Category, Inspector", async ({ page }) => {
    await expect(filterButton(page, "Period")).toBeVisible();
    await expect(filterButton(page, "Location")).toContainText("All Sites");
    await expect(filterButton(page, "User Category")).toContainText(
      "All Categories",
    );
    await expect(filterButton(page, "Inspector")).toBeDisabled();
    await expect(page.getByText("Select site & category first")).toBeVisible();
  });

  test("Open, Ready To Work, In Progress, Closed, Overdue", async ({
    page,
  }) => {
    const main = mainArea(page);

    for (const status of STATUS_CARDS) {
      const card = main
        .locator("button")
        .filter({ has: page.getByText(status, { exact: true }) });

      await expect(card).toBeVisible();
      await expect(card.getByText(/^\d+$/)).toBeVisible();
    }
  });

  test("Inspection - Actual vs Plan", async ({ page }) => {
    const actualVsPlan = chartSection(page, "Inspection");

    await expect(
      page.getByRole("heading", { name: "Inspection", exact: true, level: 3 }),
    ).toBeVisible();
    await expect(actualVsPlan.getByText("Actual vs Plan")).toBeVisible();
    await expect(
      actualVsPlan.getByRole("button", { name: "Equipment", exact: true }),
    ).toBeVisible();
    await expect(
      actualVsPlan.getByRole("button", { name: "Room", exact: true }),
    ).toBeVisible();
  });

  test("Inspection By Category - User Category", async ({ page }) => {
    const byCategory = chartSection(page, "Inspection By Category");

    await expect(
      page.getByRole("heading", { name: "Inspection By Category" }),
    ).toBeVisible();
    await expect(byCategory.getByText(/User Category/)).toBeVisible();
    await expect(
      byCategory.getByRole("button", { name: "Equipment", exact: true }),
    ).toBeVisible();
    await expect(
      byCategory.getByRole("button", { name: "Room", exact: true }),
    ).toBeVisible();
  });

  test("Top 10 Inspector - Most Inspection", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Top 10 Inspector" }),
    ).toBeVisible();
    await expect(mainArea(page).getByText("Most Inspection", { exact: true })).toBeVisible();
  });

  test("10 Newest Inspection - Newest Inspection", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "10 Newest Inspection" }),
    ).toBeVisible();
    await expect(mainArea(page).getByText("Newest Inspection", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Inspection ID" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Title" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Site / Room" }),
    ).toBeVisible();
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

  test("Inspector", async ({ page }) => {
    await filterButton(page, "Location").click();
    await page.getByRole("option", { name: "SITE A (Plant A)" }).click();

    await filterButton(page, "User Category").click();
    await page.getByRole("option", { name: "General User (0001)" }).click();

    await expect(filterButton(page, "Inspector")).toBeEnabled();
  });

  test("Open, Ready To Work, In Progress, Closed, Total sama dengan Inspection Management", async ({
    page,
  }) => {
    const dashboardCounts = {} as Record<
      (typeof SUMMARY_STATUSES)[number],
      number
    >;

    for (const status of SUMMARY_STATUSES) {
      dashboardCounts[status] = await readCountBesideLabel(page, status);
    }

    const dashboardTotal = SUMMARY_STATUSES.reduce(
      (sum, status) => sum + dashboardCounts[status],
      0,
    );

    await page.goto("/inspection/");
    await expect(page).toHaveURL(/\/inspection\/$/);
    await expect(
      page.getByRole("heading", { name: "Inspection Management", level: 1 }),
    ).toBeVisible();

    for (const status of SUMMARY_STATUSES) {
      const expected = await readCountBesideLabel(page, status);
      expect
        .soft(
          dashboardCounts[status],
          `${status} di Inspection Dashboard harus sama dengan Inspection Management`,
        )
        .toBe(expected);
    }

    expect
      .soft(
        dashboardTotal,
        "Total di Inspection Dashboard harus sama dengan Total di Inspection Management",
      )
      .toBe(await readCountBesideLabel(page, "Total"));
  });
});
