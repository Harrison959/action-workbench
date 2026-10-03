import { test, expect } from "@playwright/test";

test("production assets and persisted project detail work under the GitHub Pages subpath", async ({
  page,
}) => {
  const errors = [],
    missing = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith("http://127.0.0.1:4176"))
      missing.push(r.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
  await page.goto("./#projects");
  await page
    .getByRole("button", { name: "新建项目", exact: true })
    .first()
    .click();
  await page.getByLabel("项目名称").fill("部署验证");
  await page.getByLabel("完成结果").fill("子路径与刷新可用");
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(page).toHaveURL(/\/action-workbench\/#projects\//);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "部署验证", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".brand img")).toBeVisible();
  expect(
    await page
      .locator(".brand img")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  await page.goto("./#summary");
  await expect(
    page.getByRole("heading", { name: "每日小结", exact: true }),
  ).toBeVisible();
  await page.goto("./#schedule");
  await expect(
    page.getByRole("heading", { name: "日程", exact: true }),
  ).toBeVisible();
  await page.goto("./#cover");
  await expect(page.locator(".cover-art")).toBeVisible();
  expect(
    await page
      .locator(".cover-art")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});

test("Today decision flow and Inbox persist in the production Pages subpath", async ({
  page,
}) => {
  const errors = [],
    missing = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith("http://127.0.0.1:4176"))
      missing.push(r.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
  await page.goto("./#today");
  await expect(page.locator(".today-next")).toContainText(
    "暂无适合现在执行的任务",
  );
  await page
    .locator(".today-next")
    .getByRole("button", { name: "创建任务", exact: true })
    .click();
  await page.getByLabel("具体做什么").fill("生产环境今日重点");
  await page.getByLabel("放入当天 Top 3").check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存记录", exact: true })
    .click();
  await expect(page.locator(".today-action-title")).toHaveText(
    "生产环境今日重点",
  );
  await page.reload();
  await expect(page.locator(".today-top .task-text strong")).toHaveText(
    "生产环境今日重点",
  );
  await page
    .locator(".today-top")
    .getByRole("button", { name: "开始专注", exact: true })
    .click();
  await expect(page).toHaveURL(/#focus$/);
  await page.goto("./#today");
  await page
    .locator(".today-top")
    .getByRole("button", { name: "完成任务", exact: true })
    .click();
  await expect(page.locator(".today-progress")).toContainText("1 / 1");
  await expect(page.locator(".today-next")).toContainText(
    "暂无适合现在执行的任务",
  );
  await page.getByLabel("快速记录内容").fill("子路径快速记录");
  await page.getByRole("button", { name: "记下", exact: true }).click();
  await expect(page.getByLabel("快速记录内容")).toHaveValue("");
  await page.goto("./#inbox");
  await page.reload();
  await expect(page.getByText("子路径快速记录", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});
