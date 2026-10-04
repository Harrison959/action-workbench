import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});
test("Insight is capped, explainable, read-only, reachable under More and contextual in Weekly Review", async ({
  page,
}, info) => {
  const errors = [],
    modelRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/api\.(openai|anthropic)\.com/.test(r.url()))
      modelRequests.push(r.url());
  });
  await page.goto("/#more");
  const fixture = await page.evaluate(async () => {
    const db = await import("/src/db.js"),
      { today, addDays } = await import("/src/domain.js"),
      { weekRange } = await import("/src/features/review/weekly/selectors.js");
    const date = today(),
      week = weekRange(date),
      previous = weekRange(addDays(week.start, -7));
    await db.put(
      "project",
      {
        title: "MedicalBench MVP",
        outcome: "完成评分 API",
        status: "active",
        createdAt: addDays(date, -30) + "T12:00:00+08:00",
      },
      "medical/id 空",
    );
    for (let i = 0; i < 5; i++)
      await db.put(
        "task",
        {
          title: "本周计划" + i,
          date,
          status: i ? "open" : "done",
          completedAt: i ? null : date + "T12:00:00+08:00",
          top: true,
        },
        "plan-" + i,
      );
    for (let i = 0; i < 3; i++) {
      await db.put(
        "sleep",
        { date: addDays(date, -i), minutes: 360 },
        "current-sleep-" + i,
      );
      await db.put(
        "sleep",
        { date: addDays(date, -7 - i), minutes: 420 },
        "previous-sleep-" + i,
      );
      await db.put(
        "study",
        {
          date: addDays(date, -i),
          subject: "生物化学",
          topic: "复习",
          minutes: 40,
        },
        "current-study-" + i,
      );
      await db.put(
        "study",
        {
          date: addDays(date, -7 - i),
          subject: "生物化学",
          topic: "复习",
          minutes: 100,
        },
        "previous-study-" + i,
      );
    }
    await db.put("workout", { date, part: "背部", minutes: 30 }, "workout");
    return { date, week, previous, backup: await db.exportData() };
  });
  await page.getByRole("link", { name: "值得注意", exact: false }).click();
  await expect(page).toHaveURL(/#insights$/);
  await expect(page.locator(".insight-list > li")).toHaveCount(5);
  await expect(page.locator(".insight-list > li").first()).toContainText(
    "没有记录到推进",
  );
  const sleep = page.locator('[data-insight="sleep-change"]');
  await expect(sleep).toContainText("少 60 分钟");
  await expect(sleep).toContainText("3/7 天");
  await sleep.getByText("规则与依据", { exact: true }).click();
  await expect(sleep).toContainText("至少 45 分钟");
  await expect(sleep).toContainText("数据来源：睡眠记录");
  await page.screenshot({
    path: `.qa/insights-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator('[data-insight="project-inactive"]')
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { name: "MedicalBench MVP", exact: true }),
  ).toBeVisible();
  await page.goto("/#review?view=weekly");
  await expect(page.locator(".weekly-insights .insight-list > li")).toHaveCount(
    3,
  );
  await expect(page.locator(".weekly-insights")).toContainText(fixture.date);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/#today");
  await expect(page.locator(".insight-list")).toHaveCount(0);
  const after = await page.evaluate(async () =>
    (await import("/src/db.js")).exportData(),
  );
  expect(after.rows).toEqual(fixture.backup.rows);

  await page.goto("/#insights");
  await page
    .locator('[data-insight="review-missing"]')
    .getByRole("link")
    .click();
  await expect(page).toHaveURL(
    new RegExp("week=" + fixture.previous.start + "$"),
  );
  await page.getByLabel("下周最重要的一件事是什么？").fill("完成期末复习");
  await page
    .getByRole("button", { name: "保存周复盘与下周重点", exact: true })
    .click();
  await expect(
    page.getByText("周复盘与下周重点已保存", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.weekly-insights [data-insight="review-missing"]'),
  ).toHaveCount(0);
  // A real new note removes the project fact; opening Insight itself wrote nothing.
  await page.evaluate(async () => {
    const db = await import("/src/db.js"),
      { today } = await import("/src/domain.js");
    await db.put(
      "projectNote",
      {
        projectId: "medical/id 空",
        text: "完成了方案",
        createdAt: today() + "T12:00:00+08:00",
      },
      "note",
    );
  });
  await page.goto("/#insights");
  await expect(page.locator('[data-insight="project-inactive"]')).toHaveCount(
    0,
  );
  await expect(page.locator('[data-insight="review-missing"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-insight="sleep-change"]')).toContainText(
    "少 60 分钟",
  );
  expect(errors).toEqual([]);
  expect(modelRequests).toEqual([]);
});

test("Historical Weekly Insight uses its own reference Sunday rather than today's sliding window", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#review?view=weekly");
  const history = await page.evaluate(async () => {
    const db = await import("/src/db.js"),
      { today, addDays } = await import("/src/domain.js"),
      { weekRange } = await import("/src/features/review/weekly/selectors.js");
    const week = weekRange(addDays(weekRange(today()).start, -7));
    await db.put(
      "weeklyReview",
      { weekStart: week.start, nextMain: "已保存" },
      "review",
    );
    await db.put("workout", { date: week.end, minutes: 30 }, "workout");
    for (let i = 0; i < 3; i++) {
      await db.put(
        "sleep",
        { date: addDays(week.end, -i), minutes: 360 },
        "current-" + i,
      );
      await db.put(
        "sleep",
        { date: addDays(week.end, -7 - i), minutes: 420 },
        "previous-" + i,
      );
    }
    return week;
  });
  await page.getByRole("button", { name: "上周", exact: true }).click();
  await expect(page.locator(".weekly-insights")).toContainText(history.end);
  await expect(
    page.locator('.weekly-insights [data-insight="sleep-change"]'),
  ).toContainText("少 60 分钟");
  await expect(
    page.locator('.weekly-insights [data-insight="review-missing"]'),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "每日", exact: true }).click();
  await expect(page.locator(".weekly-insights")).toHaveCount(0);
  expect(errors).toEqual([]);
});
