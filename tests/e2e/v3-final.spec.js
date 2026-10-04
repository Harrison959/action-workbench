import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});

test("V3 income snapshot uses the same cents as the original account form and Data", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(async () => {
    const { put } = await import("/src/db.js");
    const { today } = await import("/src/domain.js");
    await put(
      "account",
      { name: "演示账号", track: "阅读", start: today() },
      "v3-account",
    );
    await put(
      "income",
      { date: today(), cents: 12345, accountId: "v3-account", track: "阅读" },
      "v3-income",
    );
  });
  await page.goto("/#income");
  const stats = page.locator(".workstream-page > .compact-stats");
  await expect(stats).toContainText("今日收入");
  await expect(stats.locator("strong")).toHaveText(["¥123.45", "¥123.45"]);
  await expect(page.locator("#income-v3-account")).toHaveValue("123.45");
  await page.goto("/#data");
  await expect(
    page.locator('[data-tracker="income.amount"] .tracker-value'),
  ).toHaveText("已录 ¥123.45");
  await page.goto("/#today");
  await expect(
    page.locator(".today-signal").filter({ hasText: "公众号收入" }),
  ).toContainText("¥123.45");
});

async function seed(page) {
  await page.goto("/#today");
  await expect(page.locator("main h1")).toBeVisible();
  return page.evaluate(async () => {
    const { put } = await import("/src/db.js");
    const { today } = await import("/src/domain.js");
    const date = today();
    await put(
      "projectNote",
      {
        projectId: "v3-project",
        text: "完成章节梳理",
        createdAt: new Date().toISOString(),
      },
      "v3-note",
    );
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

test("V3 project detail preserves outcome, progress, next action and bottom lifecycle", async ({
  page,
}) => {
  const date = await seed(page);
  await page.goto("/#projects/v3-project");
  await expect(page.locator("main h1")).toHaveText("期末复习项目");
  await expect(page.locator(".project-outcome-section")).toContainText(
    "复习四门课程",
  );
  await expect(page.locator(".project-progress-section")).toContainText(date);
  await expect(
    page
      .locator(".project-next-section")
      .getByRole("button", { name: "开始专注", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".project-lifecycle")
      .getByRole("button", { name: "编辑项目" }),
  ).toBeVisible();
  await page.locator(".project-history-disclosure > summary").click();
  await expect(page.locator(".project-history")).toBeVisible();
});

test("V3 Calendar month navigation and Inbox reuse real editors", async ({
  page,
}) => {
  const date = await seed(page);
  await page.goto("/#calendar");
  await expect(
    page.locator('.calendar-days [aria-current="date"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "上个月", exact: true }).click();
  await expect(page.getByLabel("起始日期")).not.toHaveValue(date);
  await page.getByRole("button", { name: "今天", exact: true }).click();
  await expect(page.getByLabel("起始日期")).toHaveValue(date);
  await expect(page.locator(".timeline-row")).toContainText("60 分钟");
  await page.evaluate(async () => {
    const db = await import("/src/db.js");
    await db.put(
      "inbox",
      {
        text: "整理课堂内容",
        status: "open",
        date: new Date().toISOString().slice(0, 10),
      },
      "v3-inbox",
    );
  });
  await page.goto("/#inbox");
  await page.getByRole("button", { name: "转为任务", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "关联项目", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "关联项目", exact: true })
    .selectOption("v3-project");
  await page.locator('dialog button[type="submit"]').click();
  await expect(
    page.getByRole("button", { name: "转为任务", exact: true }),
  ).toHaveCount(0);
  const saved = await page.evaluate(async () =>
    (await (await import("/src/db.js")).records()).find(
      (r) => r.kind === "task" && r.sourceId === "v3-inbox",
    ),
  );
  expect(saved.projectId).toBe("v3-project");
});

test("V3 desktop layouts use lateral space at 1024 through 1920", async ({
  page,
}) => {
  await seed(page);
  for (const width of [1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of [
      "today",
      "projects",
      "data",
      "calendar",
      "income",
      "sales",
      "settings",
    ]) {
      await page.goto("/#" + route);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (route === "today") {
        const next = await page.locator(".today-next").boundingBox();
        const signals = await page.locator(".today-signals").boundingBox();
        expect(signals.x).toBeGreaterThan(next.x + next.width);
        await expect(page.locator(".today-top .task-row")).toBeInViewport();
      }
    }
  }
});

test("V3 settings hierarchy, touch controls and long content survive responsive dark mode", async ({
  page,
}) => {
  test.setTimeout(90000);
  await seed(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.evaluate(async () => {
    const db = await import("/src/db.js");
    const rows = await db.records();
    const task = rows.find((r) => r.id === "v3-task"),
      project = rows.find((r) => r.id === "v3-project");
    await db.put(
      "task",
      { ...task, title: "很长的任务内容".repeat(28) },
      task.id,
    );
    await db.put(
      "project",
      { ...project, title: "很长的项目名称".repeat(25) },
      project.id,
    );
    await db.put(
      "projectNote",
      {
        projectId: project.id,
        text: "复习笔记内容".repeat(200),
        createdAt: new Date().toISOString(),
      },
      "long-note",
    );
  });
  for (const width of [360, 390, 412, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of [
      "today",
      "projects/v3-project",
      "data",
      "insights",
      "settings",
    ]) {
      await page.goto("/#" + route);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/#calendar");
  const sizes = await page.locator(".calendar-days button").evaluateAll((es) =>
    es.map((e) => ({
      width: e.getBoundingClientRect().width,
      height: e.getBoundingClientRect().height,
    })),
  );
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
  }
  await page.goto("/#settings");
  await expect(
    page.locator(".settings-page > .section > .section-head h2"),
  ).toHaveText(["外观", "云同步", "晚间提醒", "关于"]);
  await page.getByRole("button", { name: "深色 · 暖紫", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator(".connection-details > summary").click();
  await expect(
    page.getByRole("textbox", { name: "Supabase 项目地址" }),
  ).toBeVisible();
  await page.goto("/#today");
  await expect(page.locator(".today-top")).toContainText("P1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
