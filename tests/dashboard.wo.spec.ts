import { test, expect, type Locator, type Page } from "@playwright/test";

const STATUS_CARDS = [
  "Open",
  "Ready To Work",
  "In Progress",
  "Closed",
  "Overdue",
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

async function readFilteredListTotal(page: Page): Promise<number> {
  const pagination = mainArea(page).getByText(/\d+–\d+ of \d+/).last();
  await expect(pagination).toBeVisible();

  const match = (await pagination.innerText()).match(/of (\d+)/);
  return match ? Number(match[1]) : 0;
}

type ChartFiber = {
  stateNode?: {
    getEchartsInstance?: () => {
      getOption: () => {
        series?: { name?: string; data?: unknown[] }[];
      };
    };
  };
  return?: ChartFiber | null;
};

async function readPlanVsActualChart(
  page: Page,
): Promise<{ plan: number; actual: number }> {
  const section = page
    .getByRole("heading", { name: "Work Order", exact: true, level: 3 })
    .locator("xpath=ancestor::section[1]");

  await expect(section.locator("canvas")).toBeVisible();

  return section.evaluate((root) => {
    const toNumber = (point: unknown): number => {
      if (typeof point === "number") {
        return point;
      }

      if (
        point !== null &&
        typeof point === "object" &&
        "value" in point &&
        typeof (point as { value: unknown }).value === "number"
      ) {
        return (point as { value: number }).value;
      }

      return Number(point);
    };

    const el = root.querySelector(".echarts-for-react");
    if (!el) {
      throw new Error("Chart Actual vs Plan tidak ditemukan");
    }

    const reactKey = Object.keys(el).find(
      (key) =>
        key.startsWith("__reactFiber") ||
        key.startsWith("__reactInternalInstance"),
    );
    if (!reactKey) {
      throw new Error("React fiber chart tidak ditemukan");
    }

    let fiber: ChartFiber | null = (
      el as unknown as Record<string, ChartFiber>
    )[reactKey];
    for (let index = 0; index < 40 && fiber; index += 1) {
      const chart = fiber.stateNode?.getEchartsInstance?.();
      if (chart) {
        const series = chart.getOption().series ?? [];
        const planSeries = series.find((item) => item.name === "Plan");
        const actualSeries = series.find((item) => item.name === "Actual");

        return {
          plan: toNumber(planSeries?.data?.[0]),
          actual: toNumber(actualSeries?.data?.[0]),
        };
      }

      fiber = fiber.return ?? null;
    }

    throw new Error("Instance ECharts tidak ditemukan");
  });
}

test.describe("Work Order Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/work-order/");
  });

  test("halaman tampil", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard\/work-order\//);
    await expect(
      page.getByRole("heading", { name: "Work Order Dashboard", level: 1 }),
    ).toBeVisible();
    await expect(
      mainArea(page).getByText(
        "Overview of work orders by period, location, and category.",
      ),
    ).toBeVisible();
  });

  test("filter default", async ({ page }) => {
    await expect(filterButton(page, "Period")).toBeVisible();
    await expect(filterButton(page, "Location")).toContainText("All Sites");
    await expect(filterButton(page, "User Category")).toContainText(
      "All Categories",
    );
    await expect(filterButton(page, "Inspector")).toBeDisabled();
    await expect(page.getByText("Select site & category first")).toBeVisible();
  });

  test("kartu status", async ({ page }) => {
    const main = mainArea(page);

    for (const status of STATUS_CARDS) {
      const card = main
        .locator("button")
        .filter({ has: page.getByText(status, { exact: true }) });

      await expect(card).toBeVisible();
      await expect(card.getByText(/^\d+$/)).toBeVisible();
    }
  });

  test("widget chart", async ({ page }) => {
    const actualVsPlan = chartSection(page, "Work Order");
    const byCategory = chartSection(page, "Work Order By Category");

    await expect(
      page.getByRole("heading", { name: "Work Order", exact: true, level: 3 }),
    ).toBeVisible();
    await expect(mainArea(page).getByText("Actual vs Plan")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Work Order By Category" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Top 10 Inspector" }),
    ).toBeVisible();

    await expect(
      actualVsPlan.getByRole("button", { name: "Equipment" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      byCategory.getByRole("button", { name: "Equipment" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("chart Actual vs Plan: Plan sama total WO dan Actual sama Closed", async ({
    page,
  }) => {
    const workflowStatuses = [
      "Open",
      "Ready To Work",
      "In Progress",
      "Closed",
    ] as const;

    let totalWo = 0;
    for (const status of workflowStatuses) {
      totalWo += await readCountBesideLabel(page, status);
    }

    const closedWo = await readCountBesideLabel(page, "Closed");
    const chart = await readPlanVsActualChart(page);

    expect
      .soft(chart.plan, "Plan chart harus sama dengan total WO")
      .toBe(totalWo);
    expect
      .soft(chart.actual, "Actual chart harus sama dengan total Closed WO")
      .toBe(closedWo);
  });

  test("toggle Room pada Work Order By Category", async ({ page }) => {
    const byCategory = chartSection(page, "Work Order By Category");
    const equipment = byCategory.getByRole("button", { name: "Equipment" });
    const room = byCategory.getByRole("button", { name: "Room" });

    await room.click();

    await expect(room).toHaveAttribute("aria-pressed", "true");
    await expect(equipment).toHaveAttribute("aria-pressed", "false");
    await expect(mainArea(page).getByText("User Category · Room")).toBeVisible();
  });

  test("tabel WO terbaru", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "10 Newest Work Order" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "WO Number" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Title" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Site / Room" }),
    ).toBeVisible();
  });

  test("filter Location", async ({ page }) => {
    await filterButton(page, "Location").click();
    await page.getByRole("option", { name: "SITE A (Plant A)" }).click();

    await expect(filterButton(page, "Location")).toContainText(
      "SITE A (Plant A)",
    );
    await expect(filterButton(page, "Clear Location")).toBeVisible();

    await filterButton(page, "Clear Location").click();
    await expect(filterButton(page, "Location")).toContainText("All Sites");
  });

  test("Inspector aktif setelah site dan category dipilih", async ({
    page,
  }) => {
    await filterButton(page, "Location").click();
    await page.getByRole("option", { name: "SITE A (Plant A)" }).click();

    await filterButton(page, "User Category").click();
    await page.getByRole("option", { name: "General User (0001)" }).click();

    await expect(filterButton(page, "Inspector")).toBeEnabled();
  });

  test("total status dashboard sama dengan halaman Work Order", async ({
    page,
  }) => {
    const dashboardCounts = {} as Record<
      (typeof STATUS_CARDS)[number],
      number
    >;

    for (const status of STATUS_CARDS) {
      dashboardCounts[status] = await readCountBesideLabel(page, status);
    }

    await page.goto("/work-order/");
    await expect(page).toHaveURL(/\/work-order\/$/);
    await expect(
      page.getByRole("heading", { name: "Work Order Management", level: 1 }),
    ).toBeVisible();

    const summaryStatuses = ["Open", "In Progress", "Closed", "Overdue"] as const;
    for (const status of summaryStatuses) {
      const expected = await readCountBesideLabel(page, status);
      expect
        .soft(
          dashboardCounts[status],
          `${status} di dashboard harus sama dengan /work-order/`,
        )
        .toBe(expected);
    }

    await page.getByRole("button", { name: "Filters" }).click();
    await page.getByRole("button", { name: "Status", exact: true }).click();
    await page.getByRole("option", { name: "Ready To Work" }).click();
    await expect(
      page.getByRole("button", { name: "Status", exact: true }),
    ).toContainText("Ready To Work");
    await expect(
      page.getByRole("gridcell", { name: "Open", exact: true }),
    ).toHaveCount(0);

    expect
      .soft(
        dashboardCounts["Ready To Work"],
        "Ready To Work di dashboard harus sama dengan /work-order/",
      )
      .toBe(await readFilteredListTotal(page));
  });
});
