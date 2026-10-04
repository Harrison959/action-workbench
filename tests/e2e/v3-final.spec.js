import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});

async function seed(page) {
  await page.goto("/#today");
  await expect(page.locator("main h1")).toBeVisible();
  return page.evaluate(async () => {
    const { put } = await import("/src/db.js");
    const { today } = await import("/src/domain.js");
    const date = today();
    await put(
      "project",
      {
        title: "期末复习项目",
        outcome: "复习四门课程",
        status: "active",
        area: "study",
        nextAction: "v3-task",
        dueDate: date,
      },
      "v3-project",
    );
    await put(
      "task",
      {
        title: "复习组织学第一章",
        projectId: "v3-project",
        area: "study",
        date,
        priority: "P1",
        status: "open",
        minutes: 30,
        top: true,
      },
      "v3-task",
    );
    await put(
      "event",
      {
        title: "复习讨论",
        start: date + "T14:00",
        end: date + "T15:00",
        fixed: true,
      },
      "v3-event",
    );
    return date;
  });
}

test("V3 Tasks exposes priority, project, date and the existing Focus controls", async ({
  page,
}) => {
  const date = await seed(page);
  await page.goto("/#tasks");
  const row = page.locator('[data-task-id="v3-task"]');
  await expect(row).toContainText("P1");
  await expect(row).toContainText(date);
  await expect(row).toContainText("30 分钟");
  await expect(row.getByRole("link", { name: "期末复习项目" })).toBeVisible();
  await row.getByRole("button", { name: "开始专注", exact: true }).click();
  await expect(page.locator(".focus-clock .timer")).toBeVisible();
  await page.getByRole("button", { name: "开始 / 继续", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "开始 / 继续", exact: true }),
  ).toBeVisible();
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 800, height: 360 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

