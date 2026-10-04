import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});

test("fusion surfaces keep real records, date selection, focus and Inbox capture usable", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Mobile visual contract");
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#today");
  await expect(page.locator("main h1")).toBeVisible();
  const date = await page.evaluate(async () => {
    const db = await import("/src/db.js");
    const { today } = await import("/src/domain.js");
    const date = today();
    for (const [kind, id, data] of [
      [
        "project",
        "exam",
        {
          title: "专业课期末复习",
          outcome: "完成复习",
          status: "active",
          nextAction: "study",
        },
      ],
      [
        "task",
        "study",
        {
          title: "整理组织与胚胎学复习重点",
          status: "open",
          priority: "P1",
          top: true,
          minutes: 25,
          projectId: "exam",
        },
      ],
      ["sleep", "night", { minutes: 402 }],
      ["body", "body", { weight: 57.3 }],
      [
        "event",
        "lecture",
        { title: "生物化学课程", start: date + "T14:00:00", fixed: true },
      ],
      ["inbox", "idea", { text: "准备课程试题", status: "open" }],
      [
        "focus",
        "current-focus",
        { taskId: "study", minutes: 25, running: false, elapsed: 20000 },
      ],
    ])
      await db.put(kind, { date, legacyExtra: "retained", ...data }, id);
    return date;
  });
  await expect(page.locator(".today-action-title")).toHaveText(
    "整理组织与胚胎学复习重点",
  );
  await expect(
    page.locator(".today-signal").filter({ hasText: "睡眠记录" }),
  ).toContainText("6小时42分");
  const contrast = await page
    .locator(".action-surface")
    .evaluate((el) => ({
      background: getComputedStyle(el).backgroundImage,
      title: getComputedStyle(el.querySelector(".today-action-title")).color,
    }));
  expect(contrast.background).toContain("linear-gradient");
  expect(contrast.title).toBe("rgb(255, 255, 255)");
  const artwork = await page
    .locator(".today-head .header-art")
    .evaluate(async (img) => {
      await img.decode();
      return img.naturalWidth;
    });
  expect(artwork).toBeGreaterThan(0);
  await page.goto("/#projects");
  await expect(page.locator(".project-slab")).toContainText(
    "整理组织与胚胎学复习重点",
  );
  await page.goto("/#data");
  await expect(
    page.locator('[data-tracker="sleep.duration"] .tracker-value'),
  ).toHaveText("6小时42分");
  await expect(
    page.locator('[data-tracker="body.weight"] .tracker-record'),
  ).toHaveText(/记录/);
  await page.goto("/#focus");
  await expect(page.locator(".timer")).toHaveText("24:40");
  await expect(page.locator(".focus-session-meta")).toContainText(
    "本段计划 25 分钟",
  );
  await page.goto("/#calendar");
  await expect(
    page.getByRole("button", { name: date + " 有日程", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: date + " 有日程", exact: true })
    .click();
  await expect(page.getByLabel("起始日期")).toHaveValue(date);
  await expect(page.locator(".calendar-page .record-list")).toContainText(
    "生物化学课程",
  );
  for (const route of [
    "today",
    "projects",
    "data",
    "focus",
    "calendar",
    "inbox",
    "review",
    "review?view=weekly",
    "insights",
    "more",
  ]) {
    await page.goto("/#" + route);
    await expect(page.locator("main h1")).toBeVisible();
    await page.setViewportSize({ width: 360, height: 740 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/#inbox");
  await page.getByLabel("快速记录内容").fill("记录一次真实复习安排");
  await page.getByLabel("快速记录内容").press("Enter");
  await expect(page.locator(".inbox-page .record-list")).toContainText(
    "记录一次真实复习安排",
  );
  await page.reload();
  await expect(page.locator(".inbox-page .record-list")).toContainText(
    "记录一次真实复习安排",
  );
  const rows = await page.evaluate(async () =>
    (await import("/src/db.js")).records(),
  );
  expect(rows.find((r) => r.id === "study")).toMatchObject({
    kind: "task",
    legacyExtra: "retained",
    status: "open",
  });
  expect(
    rows.filter((r) => r.kind === "trackerEntry" || r.kind === "insight"),
  ).toEqual([]);
  expect(errors).toEqual([]);
});
