import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});
async function seed(page, records) {
  await page.goto("/#today");
  await expect(
    page.getByRole("heading", { name: "今日行动", exact: true }),
  ).toBeVisible();
  await page.evaluate(async (records) => {
    const db = await import("/src/db.js");
    const { today, addDays } = await import("/src/domain.js");
    for (const { kind, id, ...data } of records) {
      if (data.date === "today") data.date = today();
      if (data.date === "tomorrow") data.date = addDays(today(), 1);
      if (data.start?.startsWith("today"))
        data.start = data.start.replace("today", today());
      await db.put(kind, data, id);
    }
  }, records);
}
const t = (id, extra = {}) => ({
  id,
  kind: "task",
  title: id,
  date: "today",
  priority: "P2",
  status: "open",
  minutes: 25,
  ...extra,
});

test("empty decision entry, Quick Capture to existing Inbox, offline persistence and no runtime errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page, []);
  await expect(page.locator(".today-next")).toContainText(
    "暂无适合现在执行的任务",
  );
  await expect(page.locator(".today-top .task-row")).toHaveCount(0);
  await expect(page.locator(".today-progress")).toContainText("0 / 0");
  await expect(page.getByText("今天没有有明确时间的日程。")).toBeVisible();
  await page.context().setOffline(true);
  await page.getByLabel("快速记录内容").fill("  明天研究免疫学考试范围  ");
  await page.getByRole("button", { name: "记下", exact: true }).click();
  await expect(page.getByLabel("快速记录内容")).toHaveValue("");
  await page.context().setOffline(false);
  await page.reload();
  await page.goto("/#inbox");
  await expect(
    page.getByText("明天研究免疫学考试范围", { exact: true }),
  ).toBeVisible();
  const rows = await page.evaluate(async () =>
    (await import("/src/db.js")).records(),
  );
  expect(rows.filter((r) => r.kind === "inbox")).toMatchObject([
    { text: "明天研究免疫学考试范围", status: "open" },
  ]);
  expect(rows.some((r) => r.kind === "capture")).toBe(false);
  expect(errors).toEqual([]);
});

test("Top 3, detail edit, completion updates recommendation, progress and persisted legacy fields", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page, [
    t("第二件", { top: true }),
    t("第一件", { top: true, priority: "P1", legacyField: "keep" }),
    t("第三件", { top: true, priority: "P3" }),
    t("普通任务", { priority: "P1" }),
    t("第四个历史重点", { top: true, priority: "P4" }),
  ]);
  const top = page.locator(".today-top");
  await expect(top.locator(".task-row")).toHaveCount(3);
  await expect(top.locator(".task-text strong")).toHaveText([
    "第一件",
    "第二件",
    "第三件",
  ]);
  await expect(top).not.toContainText("普通任务");
  await expect(page.locator(".today-action-title")).toHaveText("第一件");
  await expect(top.locator(".task-row").nth(2)).toBeInViewport();
  await page.screenshot({
    path: ".qa/today-normal-" + info.project.name + ".png",
    fullPage: true,
  });
  await top
    .locator(".task-row")
    .first()
    .getByRole("button", { name: "完成任务", exact: true })
    .click();
  await expect(page.locator(".today-action-title")).toHaveText("第二件");
  await expect(page.locator(".today-progress")).toContainText("1 / 5");
  await expect(top.locator(".today-task-number")).toHaveText(["1", "2", "3"]);
  await top.getByRole("button", { name: /第二件.*25 分钟/ }).click();
  await page.getByLabel("具体做什么").fill("修改后的第二件");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存记录", exact: true })
    .click();
  await expect(page.locator(".today-action-title")).toHaveText(
    "修改后的第二件",
  );
  await page.reload();
  await expect(page.locator(".today-progress")).toContainText("1 / 5");
  await expect(page.locator(".today-action-title")).toHaveText(
    "修改后的第二件",
  );
  const row = await page.evaluate(async () =>
    (await (await import("/src/db.js")).records()).find(
      (r) => r.id === "第一件",
    ),
  );
  expect(row).toMatchObject({ status: "done", legacyField: "keep" });
  expect(errors).toEqual([]);
});

test("Project nextAction participates but respects explicit today priorities and future plans", async ({
  page,
}) => {
  await seed(page, [
    {
      kind: "project",
      id: "p",
      title: "考试及格",
      status: "active",
      nextAction: "项目下一步",
    },
    t("项目下一步", { projectId: "p" }),
    t("普通紧急", { priority: "P1" }),
  ]);
  await expect(page.locator(".today-action-title")).toHaveText("项目下一步");
  await expect(page.locator(".today-action-meta")).toContainText("考试及格");
  await expect(page.locator(".today-reason")).toContainText("项目指定");
  await page.evaluate(async () => {
    const db = await import("/src/db.js");
    const { today } = await import("/src/domain.js");
    await db.put(
      "task",
      {
        title: "明确重点",
        date: today(),
        top: true,
        priority: "P3",
        status: "open",
      },
      "top",
    );
  });
  await expect(page.locator(".today-action-title")).toHaveText("明确重点");
  await page.evaluate(async () => {
    const db = await import("/src/db.js");
    const rows = await db.records();
    const { today, addDays } = await import("/src/domain.js");
    await db.put(
      "task",
      { ...rows.find((r) => r.id === "项目下一步"), date: addDays(today(), 1) },
      "项目下一步",
    );
    await db.put(
      "task",
      { ...rows.find((r) => r.id === "top"), status: "done" },
      "top",
    );
  });
  await expect(page.locator(".today-action-title")).toHaveText("普通紧急");
});

test("Focus wins, resume retains elapsed, and finished Focus releases recommendation", async ({
  page,
}) => {
  await seed(page, [
    t("今天重点", { top: true }),
    t("正在做的旧任务", { date: "2026-01-01" }),
    {
      kind: "focus",
      id: "aaa-legacy-focus",
      taskId: "今天重点",
      elapsed: 20000,
      running: false,
      minutes: 25,
    },
    {
      kind: "focus",
      id: "current-focus",
      taskId: "正在做的旧任务",
      elapsed: 60000,
      running: false,
      minutes: 25,
    },
  ]);
  await expect(page.locator(".today-action-title")).toHaveText(
    "正在做的旧任务",
  );
  await expect(page.locator(".today-reason")).toContainText("已暂停");
  await page
    .locator(".today-next")
    .getByRole("button", { name: "开始专注", exact: true })
    .click();
  await expect(page).toHaveURL(/#focus$/);
  await expect(page.locator(".focus-page")).toContainText("正在做的旧任务");
  const f = await page.evaluate(async () =>
    (await (await import("/src/db.js")).records()).find(
      (r) => r.id === "current-focus",
    ),
  );
  expect(f.elapsed).toBe(60000);
  await page.evaluate(async () => {
    const db = await import("/src/db.js");
    const f = (await db.records()).find((r) => r.id === "current-focus");
    await db.put("focus", { ...f, running: true, started: Date.now() }, f.id);
  });
  await page.goto("/#today");
  await expect(page.locator(".today-reason")).toHaveText("正在专注的任务");
  await page.evaluate(async () => {
    const db = await import("/src/db.js");
    const f = (await db.records()).find((r) => r.id === "current-focus");
    await db.put(
      "focus",
      { ...f, running: false, elapsed: 0, started: null },
      f.id,
    );
  });
  await expect(page.locator(".today-action-title")).toHaveText("今天重点");
});

test("All dated Events sorted; ordinary Todos stay off timeline; dense mobile layout has no overflow", async ({
  page,
}, info) => {
  const longTitle =
    "这是一条很长的任务与项目名称用于检查窄屏布局不产生横向溢出".repeat(3);
  await seed(page, [
    t(longTitle, { top: true, projectId: "p" }),
    { kind: "project", id: "p", title: longTitle, status: "active" },
    ...["22:00", "08:00", "13:00", "10:00"].map((time, i) => ({
      kind: "event",
      id: "e" + i,
      title: "安排" + i,
      start: "todayT" + time,
      fixed: i % 2 === 0,
    })),
  ]);
  await expect(page.locator(".today-timeline time")).toHaveText([
    "08:00",
    "10:00",
    "13:00",
    "22:00",
  ]);
  await expect(page.locator(".today-timeline li")).toHaveCount(4);
  await expect(page.locator(".today-timeline")).not.toContainText(longTitle);
  await expect(page.locator(".today-timeline li>span")).toHaveText([
    "可调整",
    "可调整",
    "固定",
    "固定",
  ]);
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
  await page.screenshot({
    path: ".qa/today-" + info.project.name + ".png",
    fullPage: true,
  });
});
