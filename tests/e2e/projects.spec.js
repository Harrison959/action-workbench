import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});
const save = (page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "保存记录", exact: true })
    .click();
async function createProject(page, title = "期末复习") {
  await page.goto("/#projects");
  await page
    .getByRole("button", { name: "新建项目", exact: true })
    .first()
    .click();
  await page.getByLabel("项目名称").fill(title);
  await page.getByLabel("完成结果").fill("完成两轮复习，考试及格");
  await page.getByLabel("所属领域").selectOption("study");
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}
async function addTask(page, title) {
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.getByLabel("具体做什么").fill(title);
  await save(page);
  await expect(
    page.locator(".project-task").filter({ hasText: title }),
  ).toBeVisible();
}

test("project workflow: next action, computed progress, focus, notes and lifecycle", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createProject(page);
  const detail = page.url();
  await addTask(page, "阅读上皮组织");
  await addTask(page, "练习二十道题");
  await page.getByRole("button", { name: "设置下一步", exact: true }).click();
  await page.getByLabel("下一步任务").selectOption({ label: "阅读上皮组织" });
  await save(page);
  await expect(page.locator(".next-action-row h3")).toHaveText("阅读上皮组织");
  const first = page
    .locator(".project-task")
    .filter({ hasText: "阅读上皮组织" });
  await first.getByRole("button", { name: "完成任务", exact: true }).click();
  await expect(
    page.getByRole("progressbar", { name: "任务完成进度" }),
  ).toHaveAttribute("value", "50");
  await expect(page.locator(".next-action-row h3")).toHaveText("练习二十道题");
  await expect(page.getByText("尚未指定，建议先做")).toBeVisible();
  await page.getByRole("button", { name: "设为下一步", exact: true }).click();
  await page
    .locator(".next-action-row")
    .getByRole("button", { name: "开始专注", exact: true })
    .click();
  await expect(page).toHaveURL(/#focus$/);
  await expect(
    page.getByText("练习二十道题", { exact: true }).first(),
  ).toBeVisible();
  await page.goto(detail);
  await page.getByRole("button", { name: "添加笔记", exact: true }).click();
  await page.getByLabel("笔记内容").fill("复习连接结构的异同");
  await save(page);
  await expect(
    page
      .locator(".record-content")
      .getByText("复习连接结构的异同", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "50");
  await page.getByRole("button", { name: "暂停项目", exact: true }).click();
  await expect(page.locator(".project-info .project-status")).toHaveText(
    "已暂停",
  );
  await expect(
    page.locator(".next-action-row").getByRole("button", { name: "开始专注" }),
  ).toBeDisabled();
  await page.goto("/#projects");
  await page.getByRole("tab", { name: "已暂停", exact: true }).click();
  await page.locator(".project-list-row").click();
  await page.getByRole("button", { name: "恢复进行", exact: true }).click();
  await page
    .locator(".project-task")
    .filter({ hasText: "练习二十道题" })
    .getByRole("button", { name: "完成任务", exact: true })
    .click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "100");
  await page.getByRole("button", { name: "标记完成", exact: true }).click();
  await expect(page.locator(".project-info .project-status")).toHaveText(
    "已完成",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    style: ".toast { visibility:hidden }",
    path: ".qa/" + info.project.name + "-project-detail.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "归档项目", exact: true }).click();
  await page.goto("/#more");
  await page.getByRole("link", { name: "已归档项目" }).click();
  await expect(
    page.getByRole("tab", { name: "已归档", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".project-list-row")).toHaveCount(1);
  await page.getByRole("tab", { name: "全部", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "全部", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

test("legacy task association, offline writes, export/import and soft deletion", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(async () => {
    const db = await import("/src/db.js");
    const { today } = await import("/src/domain.js");
    await db.put(
      "task",
      {
        title: "旧任务",
        date: today(),
        minutes: 20,
        status: "open",
        priority: "P1",
        stream: "courses",
        goalId: "g-old",
        note: "旧备注",
        custom: { preserved: 1 },
      },
      "legacy-task",
    );
    await db.put(
      "income",
      { date: today(), accountId: "old-account", cents: 55321 },
      "legacy-income",
    );
  });
  await createProject(page, "离线项目");
  const detail = page.url();
  await page.getByRole("button", { name: "关联已有任务", exact: true }).click();
  await page.getByLabel("选择独立任务").selectOption("legacy-task");
  await save(page);
  await page.locator(".project-task .task-text").click();
  await page.getByLabel("具体做什么").fill("旧任务已整理");
  await save(page);
  await page.context().setOffline(true);
  await addTask(page, "离线新增任务");
  await page.getByRole("button", { name: "添加笔记", exact: true }).click();
  await page.getByLabel("笔记内容").fill("离线笔记");
  await save(page);
  await page
    .locator(".project-task")
    .filter({ hasText: "离线新增任务" })
    .getByRole("button", { name: "完成任务", exact: true })
    .click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "50");
  await page.context().setOffline(false);
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "50");
  await page
    .locator(".project-lifecycle")
    .getByRole("button", { name: "移入回收站", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "移入回收站", exact: true })
    .click();
  await expect(page).toHaveURL(/#projects$/);
  await page.goto("/#tasks");
  await expect(page.getByText("旧任务已整理", { exact: true })).toBeVisible();
  await expect(page.getByText("原项目待同步或在回收站").first()).toBeVisible();
  await page.goto("/#settings");
  await page.getByText("1 条记录可恢复", { exact: true }).click();
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await page.goto(detail);
  await expect(
    page.getByRole("heading", { name: "离线项目", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".record-content").getByText("离线笔记", { exact: true }),
  ).toBeVisible();
  await page.goto("/#settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出记录", exact: true }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  const legacy = backup.rows.find((r) => r.id === "legacy-task");
  expect(legacy.data).toMatchObject({
    stream: "courses",
    goalId: "g-old",
    note: "旧备注",
    custom: { preserved: 1 },
  });
  expect(backup.rows.find((r) => r.id === "legacy-income").data.cents).toBe(
    55321,
  );
  expect(backup.rows.filter((r) => r.kind === "projectNote")).toHaveLength(1);
  // Import the actual exported file into a new isolated browser context.
  const context = await page
    .context()
    .browser()
    .newContext({ ...info.project.use, baseURL: "http://127.0.0.1:4175" });
  await context.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
  const other = await context.newPage();
  await other.goto("/#settings");
  await other
    .locator('input[type="file"]')
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await expect(other.getByText(/导入 \d+ 条新记录/)).toBeVisible();
  await other.goto(detail);
  await expect(other.getByRole("progressbar")).toHaveAttribute("value", "50");
  await expect(
    other.locator(".project-task").filter({ hasText: "旧任务已整理" }),
  ).toBeVisible();
  await context.close();
  expect(errors).toEqual([]);
});

test("inbox can become a project without duplicating it, details fit small screens", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#inbox");
  await page
    .locator("main")
    .getByRole("button", { name: "快速记录", exact: true })
    .click();
  await page.getByLabel("想到什么？").fill("准备小组汇报");
  await save(page);
  await page.getByRole("button", { name: "转为项目", exact: true }).click();
  await page.getByLabel("完成结果").fill("完成十分钟课堂汇报");
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "准备小组汇报", exact: true }),
  ).toBeVisible();
  await addTask(page, "整理所有需要展示的资料并与小组成员确认内容和分工");
  await page.getByRole("button", { name: "设置下一步", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.goto("/#inbox");
  await page.getByText("已整理 1 条", { exact: true }).click();
  await page.getByRole("button", { name: "放回收件箱", exact: true }).click();
  await page.getByRole("button", { name: "转为项目", exact: true }).click();
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  await expect(page.getByRole("heading", { name: "准备小组汇报", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/#projects");
  await expect(page.locator(".project-list-row")).toHaveCount(1);
  await page.locator(".project-list-row").click();
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    style: ".toast { visibility:hidden }",
    path: ".qa/" + info.project.name + "-project-active.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
