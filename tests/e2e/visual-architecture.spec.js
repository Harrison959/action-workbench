import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ page }, info) => {
  test.skip(
    info.project.name !== "mobile",
    "Phone visual architecture acceptance",
  );
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});
const nav = (page) => page.getByRole("navigation", { name: "手机导航" });
const checkWidth = async (page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
const screenshot = async (page, name) => {
  await expect(page.locator("main h1")).toBeVisible();
  // Existing success/undo notifications last 5.5s; capture the settled screen.
  await expect(page.locator(".toast")).toHaveCount(0, { timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll("dialog")]
        .flatMap((el) => el.getAnimations())
        .filter((a) => Number.isFinite(a.effect.getTiming().iterations))
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  await page.screenshot({ path: `.qa/phase9b/${name}.png`, scale: "css" });
};

test("phone architecture: slots, row actions, vertical timeline and six acceptance screenshots", async ({
  page,
}) => {
  test.setTimeout(60000);
  await mkdir(".qa/phase9b", { recursive: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#today");
  await expect(page.locator(".today-slots > li")).toHaveCount(3);
  await expect(page.locator(".today-slot-number")).toHaveText([
    "01",
    "02",
    "03",
  ]);
  const empty = await page.locator(".action-surface").boundingBox();
  expect(empty.height).toBeLessThan(155);
  await checkWidth(page);
  await screenshot(page, "today-empty");
  // The vacant slot is a full-row keyboard-operable link to the existing plan.
  await page
    .getByRole("link", { name: "安排第2个今日重点", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#plan$/);
  await page.goto("/#today");
  await page.evaluate(async () => {
    const db = await import("/src/db.js"),
      { today } = await import("/src/domain.js");
    const date = today();
    for (const [kind, id, data] of [
      [
        "project",
        "exam",
        {
          title: "专业课期末复习",
          outcome: "整理四门课的考试重点",
          status: "active",
          nextAction: "study-task",
        },
      ],
      [
        "project",
        "media",
        {
          title: "公众号账号经营",
          outcome: "完成本月收入与赛道对比",
          status: "active",
        },
      ],
      [
        "task",
        "study-task",
        {
          title: "整理组织与胚胎学复习资料",
          minutes: 25,
          top: true,
          priority: "P1",
          status: "open",
          projectId: "exam",
          legacyExtra: "retained",
        },
      ],
      [
        "task",
        "income-task",
        {
          title: "核对各账号今天的收入",
          minutes: 15,
          top: true,
          priority: "P2",
          status: "open",
          projectId: "media",
        },
      ],
      [
        "event",
        "lecture",
        { title: "生物化学课程", start: date + "T14:00:00", fixed: true },
      ],
      [
        "event",
        "practice",
        { title: "吉他练习", start: date + "T18:30:00", fixed: false },
      ],
      ["sleep", "sleep", { minutes: 402 }],
      ["body", "body", { weight: 57.3 }],
      ["workout", "workout", { minutes: 45 }],
      ["study", "study", { minutes: 45 }],
      ["episode", "english", { minutes: 20 }],
      ["guitar", "guitar", { minutes: 20 }],
      ["emotion", "emotion", { mood: "平静", intensity: 3 }],
      ["account", "account", { name: "读书号", track: "阅读" }],
      ["income", "income", { accountId: "account", cents: 12345 }],
    ])
      await db.put(kind, { date, ...data }, id);
  });
  await expect(page.locator(".today-action-title")).toContainText("整理组织");
  await expect(page.locator(".today-timeline .timeline-marker")).toHaveCount(2);
  await expect(page.locator(".today-timeline time")).toHaveText([
    "14:00",
    "18:30",
  ]);
  await checkWidth(page);
  await screenshot(page, "today-with-data");
  // Clicking the number gutter exercises the whole-row task detail hit area.
  await page
    .locator(".today-top .task-row")
    .first()
    .click({ position: { x: 12, y: 24 } });
  await expect(page.getByLabel("具体做什么")).toHaveValue(
    "整理组织与胚胎学复习资料",
  );
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.locator(".today-top .check").first().click();
  await expect(page.locator(".today-top .done")).toContainText("整理组织");
  await expect(page.locator(".today-action-title")).toContainText("核对各账号");
  await page.getByLabel("快速记录内容").fill("查找免疫学历年试题");
  await page.getByLabel("快速记录内容").press("Enter");
  await expect(page.getByLabel("快速记录内容")).toHaveValue("");
  await nav(page).getByRole("link", { name: "项目", exact: true }).click();
  await expect(page.locator(".project-slab")).toHaveCount(2);
  await checkWidth(page);
  await screenshot(page, "projects");
  await nav(page).getByRole("link", { name: "更多", exact: true }).click();
  await screenshot(page, "more");
  await page.locator('.mobile-more a[href="#data"]').click();
  await expect(page.locator(".tracker-group")).toHaveCount(4);
  for (const box of await page
    .locator(".tracker-line")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) {
    expect(box).toBeGreaterThanOrEqual(56);
    expect(box).toBeLessThanOrEqual(64);
  }
  await checkWidth(page);
  await screenshot(page, "data");
  await page.getByRole("button", { name: "记录体重", exact: true }).click();
  await page.getByLabel("体重（kg）").fill("57.8");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  // Body has no measurement time: two same-day values use the existing stable
  // ID order, not save time. Verify the refreshed ambiguity and original write.
  await expect(
    page.locator('[data-tracker="body.weight"] .tracker-context'),
  ).toContainText("无法确认实际先后");
  await expect(
    page.locator('[data-tracker="body.weight"] .tracker-value'),
  ).toHaveText(/57\.(3|8) kg/);
  expect(
    await page.evaluate(async () =>
      (await (await import("/src/db.js")).records())
        .filter((r) => r.kind === "body")
        .map((r) => Number(r.weight))
        .sort(),
    ),
  ).toEqual([57.3, 57.8]);
  await page.locator('[data-tracker="body.weight"] summary').click();
  await expect(
    page.locator('[data-tracker="body.weight"] details'),
  ).toHaveAttribute("open", "");
  await page.locator('[data-tracker="body.weight"] .tracker-open').click();
  await expect(page).toHaveURL(/#fitness$/);
  await page.goto("/#more");
  await nav(page).getByRole("button", { name: "添加", exact: true }).click();
  await screenshot(page, "add-sheet");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.reload();
  const rows = await page.evaluate(async () =>
    (await import("/src/db.js")).records(),
  );
  expect(rows.find((r) => r.id === "study-task")).toMatchObject({
    status: "done",
    legacyExtra: "retained",
  });
  expect(rows.some((r) => r.kind === "trackerEntry")).toBe(false);
  expect(rows.find((r) => r.kind === "inbox").text).toBe("查找免疫学历年试题");
  expect(errors).toEqual([]);
});
