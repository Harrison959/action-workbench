import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});
const palette = (page) =>
  page.getByRole("dialog", { name: "命令中心", exact: true });
const search = (page) =>
  page.getByRole("combobox", { name: "搜索命令、项目或任务" });
async function open(page) {
  await page.keyboard.press("Control+k");
  await expect(palette(page)).toBeVisible();
  await expect(search(page)).toBeFocused();
}
async function command(page, name) {
  await open(page);
  await search(page).fill(name);
  await page.getByRole("option", { name, exact: true }).click();
  await expect(palette(page)).toHaveCount(0);
}
async function seed(page, rows) {
  await page.goto("/#today");
  await expect(
    page.getByRole("heading", { name: "今日行动", exact: true }),
  ).toBeVisible();
  await page.evaluate(async (rows) => {
    const db = await import("/src/db.js"),
      { today } = await import("/src/domain.js");
    for (const { kind, id, ...data } of rows) {
      if (data.date === "today") data.date = today();
      await db.put(kind, data, id);
    }
  }, rows);
}
const save = (page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "保存记录", exact: true })
    .click();

test.describe("desktop command center", () => {
  test.beforeEach(async ({ isMobile }) =>
    test.skip(isMobile, "Phone keeps its existing Add Menu"),
  );
  test("Ctrl toggle, Esc, focus restoration, arrows, empty search and close-button Enter", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await seed(page, []);
    const trigger = page.getByRole("button", { name: "打开命令中心" });
    await trigger.focus();
    await open(page);
    await expect(page.getByRole("option").first()).toHaveText("新建任务");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("option", { selected: true })).toHaveText(
      "快速记录到收件箱",
    );
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("option", { selected: true })).toHaveText(
      "新建任务",
    );
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("option", { selected: true })).toHaveText(
      "打开更多",
    );
    await page.keyboard.press("Control+k");
    await expect(palette(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await search(page).fill("不存在的内容xyz");
    await expect(page.getByRole("option")).toHaveCount(0);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await open(page);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "关闭命令中心" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(palette(page)).toHaveCount(0);
    await page.getByLabel("快速记录内容").focus();
    await page.keyboard.press("Control+k");
    await expect(palette(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
  test("Mac uses Cmd K and leaves Ctrl/Shift/Alt variants alone", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
      Object.defineProperty(navigator, "userAgentData", {
        get: () => undefined,
      });
    });
    await seed(page, []);
    await expect(
      page.getByRole("button", { name: "打开命令中心" }),
    ).toContainText("⌘ K");
    await page.keyboard.press("Control+k");
    await expect(palette(page)).toHaveCount(0);
    await page.keyboard.press("Meta+Shift+k");
    await expect(palette(page)).toHaveCount(0);
    await page.keyboard.press("Meta+k");
    await expect(search(page)).toBeFocused();
    await page.keyboard.press("Meta+k");
    await expect(palette(page)).toHaveCount(0);
  });
  test("Commands remain global across all major pages and use existing routes", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await seed(page, []);
    for (const [route, label] of [
      ["projects", "打开项目"],
      ["calendar", "打开日历"],
      ["review", "打开复盘"],
      ["inbox", "打开收件箱"],
      ["data", "打开数据"],
      ["more", "打开更多"],
      ["today", "打开今天"],
    ]) {
      await command(page, label);
      await expect(page).toHaveURL(new RegExp("#" + route + "$"));
      await expect(page.locator("#main h1")).toBeFocused();
    }
    for (const route of ["tasks", "focus"]) {
      await page.goto("/#" + route);
      await expect(page.locator("#main h1")).toBeVisible();
      await open(page);
      await page.keyboard.press("Escape");
    }
    expect(errors).toEqual([]);
  });
  test("Enter creates task and capture; form editing is not interrupted; records survive reload", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await seed(page, []);
    await open(page);
    await search(page).fill("新建任务");
    await page.keyboard.press("Enter");
    await expect(palette(page)).toHaveCount(0);
    await expect(page.getByLabel("具体做什么")).toBeFocused();
    await page.getByLabel("具体做什么").fill("键盘创建任务");
    await page.keyboard.press("Control+k");
    await expect(palette(page)).toHaveCount(0);
    await save(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "打开命令中心" }).focus();
    await open(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("想到什么？")).toBeFocused();
    await page.getByLabel("想到什么？").fill("先记录，稍后整理");
    await save(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".today-action-title")).toHaveText(
      "键盘创建任务",
    );
    await command(page, "打开收件箱");
    await expect(
      page.getByText("先记录，稍后整理", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
  test("Real Project and unfinished Task substring search opens details and preserves unknown fields", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await seed(page, [
      {
        kind: "project",
        id: "p",
        title: "MedicalBench MVP",
        status: "active",
        outcome: "可运行的评分模块",
      },
      { kind: "project", id: "arch", title: "Medical old", status: "archived" },
      {
        kind: "task",
        id: "t",
        title: "完成 MedicalBench 评分 API",
        projectId: "p",
        date: "today",
        minutes: 45,
        status: "open",
        unknown: "preserved",
      },
      { kind: "task", id: "done", title: "Medical 已完成", status: "done" },
    ]);
    await open(page);
    await search(page).fill("mEDical");
    await expect(page.getByRole("option")).toHaveCount(2);
    await expect(page.getByRole("option").first()).toContainText(
      "MedicalBench MVP",
    );
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#projects\/p$/);
    await expect(
      page.getByRole("heading", { name: "MedicalBench MVP", exact: true }),
    ).toBeVisible();
    await open(page);
    await search(page).fill("评分 API");
    await page.getByRole("option").click();
    await expect(page.getByRole("dialog", { name: "任务详情" })).toBeVisible();
    await page.getByLabel("具体做什么").fill("更新 MedicalBench 评分 API");
    await save(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const task = await page.evaluate(async () =>
      (await (await import("/src/db.js")).records()).find((r) => r.id === "t"),
    );
    expect(task.unknown).toBe("preserved");
    expect(task.title).toBe("更新 MedicalBench 评分 API");
    await open(page);
    await search(page).fill("更新");
    await expect(page.getByRole("option")).toHaveCount(1);
    await page.screenshot({ path: ".qa/command-search.png" });
    expect(errors).toEqual([]);
  });
  test("Project/event creation and daily review reuse existing forms, resetting historical Review correctly", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await seed(page, []);
    await command(page, "新建项目");
    await page.getByLabel("项目名称").fill("命令创建项目");
    await page.getByLabel("完成结果").fill("完成命令验收");
    await page.getByRole("button", { name: "创建项目", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "命令创建项目", exact: true }),
    ).toBeVisible();
    await command(page, "添加日程");
    await page.getByLabel("约定内容").fill("测试固定安排");
    await save(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await command(page, "打开日历");
    await expect(page.getByText("测试固定安排", { exact: true })).toBeVisible();
    await command(page, "打开复盘");
    await page.getByLabel("小结日期").fill("2026-01-01");
    await page.getByRole("button", { name: "打开命令中心" }).focus();
    await command(page, "写每日小结");
    const today = await page.evaluate(async () =>
      (await import("/src/domain.js")).today(),
    );
    await expect(page.getByLabel("小结日期")).toHaveValue(today);
    await expect(page.getByLabel("今天推进了什么")).toBeFocused();
    await page.getByLabel("今天推进了什么").fill("命令入口验证完成");
    await page.getByRole("button", { name: "保存小结", exact: true }).click();
    await page.getByLabel("小结日期").fill("2026-01-01");
    await expect(page.getByLabel("小结日期")).toHaveValue("2026-01-01");
    await page.getByRole("button", { name: "打开命令中心" }).focus();
    await command(page, "写每日小结");
    await expect(page.getByLabel("小结日期")).toHaveValue(today);
    await expect(page.getByLabel("今天推进了什么")).toHaveValue(
      "命令入口验证完成",
    );
    expect(errors).toEqual([]);
  });
  test("Focus fallback, Today recommendation, running/paused resume and invalid session recovery", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await seed(page, []);
    await command(page, "开始专注");
    await expect(page).toHaveURL(/#focus$/);
    await seed(page, [
      {
        kind: "task",
        id: "t",
        title: "应该现在做的任务",
        date: "today",
        top: true,
        status: "open",
        minutes: 30,
      },
    ]);
    await command(page, "开始专注");
    await expect(page).toHaveURL(/#focus$/);
    await expect(
      page.getByRole("heading", { name: "应该现在做的任务" }),
    ).toBeVisible();
    await page.evaluate(async () => {
      const db = await import("/src/db.js");
      await db.put(
        "focus",
        { taskId: "t", elapsed: 120000, running: false, minutes: 30 },
        "current-focus",
      );
    });
    await page.goto("/#more");
    await command(page, "继续专注：应该现在做的任务");
    let focus = await page.evaluate(async () =>
      (await (await import("/src/db.js")).records()).find(
        (r) => r.id === "current-focus",
      ),
    );
    expect(focus.elapsed).toBe(120000);
    expect(focus.running).toBe(false);
    await page.getByRole("button", { name: "开始 / 继续" }).click();
    await open(page);
    await expect(
      page.getByRole("option", {
        name: "继续专注：应该现在做的任务",
        exact: true,
      }),
    ).toBeVisible();
    await search(page).fill("继续专注");
    await page.keyboard.press("Enter");
    focus = await page.evaluate(async () =>
      (await (await import("/src/db.js")).records()).find(
        (r) => r.id === "current-focus",
      ),
    );
    expect(focus.running).toBe(true);
    expect(focus.elapsed).toBe(120000);
    await page.evaluate(async () => {
      const db = await import("/src/db.js");
      await db.put(
        "focus",
        { taskId: "missing", running: true, elapsed: 10000 },
        "current-focus",
      );
    });
    await page.goto("/#today");
    await command(page, "开始专注");
    await expect(
      page.getByRole("heading", { name: "应该现在做的任务" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test("mobile Add Menu remains unchanged and command shortcuts do not take over", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile-specific Add Menu regression");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page, []);
  await expect(page.getByRole("button", { name: "打开命令中心" })).toBeHidden();
  await page.keyboard.press("Control+k");
  await expect(palette(page)).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "手机导航" });
  await expect(nav.locator("a,button")).toHaveCount(5);
  await nav.getByRole("button", { name: "添加", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "添加", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "快速记录到收件箱", exact: true })
    .click();
  await page.getByLabel("想到什么？").fill("手机添加不受影响");
  await save(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/#inbox");
  await expect(
    page.getByText("手机添加不受影响", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
