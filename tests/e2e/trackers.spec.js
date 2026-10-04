import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});
test("Data reads old records without writes; source routes, range, backup, refresh and mobile remain usable", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#data");
  await expect(
    page.getByRole("heading", { name: "数据", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-tracker="body.weight"] .tracker-value'),
  ).toHaveText("—");
  const before = await page.evaluate(async () => {
    const db = await import("/src/db.js"),
      { today } = await import("/src/domain.js");
    for (const [kind, id, data] of [
      ["sleep", "s", { minutes: 402 }],
      ["body", "a", { weight: 58 }],
      ["body", "z", { weight: 57.3 }],
      ["workout", "w", { minutes: 45 }],
      ["study", "st", { minutes: 120 }],
      ["episode", "ep", { minutes: 22 }],
      ["reading", "r", { minutes: 8 }],
      ["guitar", "g", { minutes: 20 }],
      ["income", "i", { cents: 3200 }],
      ["emotion", "em", { time: "12:00", mood: "平静", intensity: 3 }],
    ])
      await db.put(kind, { date: today(), ...data }, id);
    return db.exportData();
  });
  for (const [id, value] of [
    ["sleep.duration", "402 分钟"],
    ["body.weight", "57.3 kg"],
    ["workout.minutes", "45 分钟"],
    ["study.minutes", "120 分钟"],
    ["english.minutes", "30 分钟"],
    ["guitar.minutes", "20 分钟"],
    ["income.amount", "已录 ¥32.00"],
    ["emotion.intensity", "3 / 5"],
  ])
    await expect(
      page.locator(`[data-tracker="${id}"] .tracker-value`),
    ).toHaveText(value);
  await expect(
    page.locator('[data-tracker="emotion.intensity"]'),
  ).toContainText("平静");
  await page.getByLabel("指标汇总范围").selectOption("30");
  await page.locator('[data-tracker="english.minutes"] summary').click();
  await expect(
    page.locator('[aria-label="英语学习时长每日汇总"] li'),
  ).toHaveCount(30);
  await expect(page.locator('[data-tracker="english.minutes"]')).toContainText(
    "单词记录没有时长",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const [id, route] of [
    ["sleep.duration", "sleep"],
    ["body.weight", "fitness"],
    ["workout.minutes", "fitness"],
    ["study.minutes", "courses"],
    ["english.minutes", "english"],
    ["guitar.minutes", "guitar"],
    ["income.amount", "income"],
    ["emotion.intensity", "emotion"],
  ]) {
    await page
      .getByLabel(
        "打开" +
          {
            "sleep.duration": "睡眠时长",
            "body.weight": "体重",
            "workout.minutes": "运动时长",
            "study.minutes": "专业课学习时长",
            "english.minutes": "英语学习时长",
            "guitar.minutes": "吉他练习时长",
            "income.amount": "公众号收入",
            "emotion.intensity": "情绪强度",
          }[id] +
          "原始记录",
      )
      .click();
    await expect(page).toHaveURL(new RegExp("#" + route + "$"));
    await expect(page.locator("main h1")).toBeVisible();
    await page.goto("/#data");
  }
  await page.reload();
  await expect(
    page.locator('[data-tracker="body.weight"] .tracker-value'),
  ).toHaveText("57.3 kg");
  const after = await page.evaluate(async () =>
    (await import("/src/db.js")).exportData(),
  );
  expect(after.rows).toEqual(before.rows);
  await page.evaluate(async () => {
    const db = await import("/src/db.js");
    await db.remove("z");
  });
  await expect(
    page.locator('[data-tracker="body.weight"] .tracker-value'),
  ).toHaveText("58 kg");
  await page.evaluate(async () => {
    const db = await import("/src/db.js");
    await db.restore("z");
  });
  await expect(
    page.locator('[data-tracker="body.weight"] .tracker-value'),
  ).toHaveText("57.3 kg");
  expect(errors).toEqual([]);
});
