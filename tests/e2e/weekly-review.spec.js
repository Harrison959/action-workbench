import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});
test("weekly facts, periods, manual priorities persist without touching tasks/projects; mobile and Daily coexist", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#review");
  await expect(
    page.getByRole("heading", { name: "每日小结", exact: true }),
  ).toBeVisible();
  const before = await page.evaluate(async () => {
    const db = await import("/src/db.js"),
      { weekRange } = await import("/src/features/review/weekly/selectors.js");
    const { today } = await import("/src/domain.js");
    const week = weekRange(today());
    const rows = [
      [
        "project",
        "p",
        {
          title: "考试复习",
          outcome: "通过期末",
          status: "active",
          createdAt: week.start + "T00:00:00+08:00",
          nextAction: "next",
        },
      ],
      [
        "project",
        "idle",
        {
          title: "尚未推进",
          outcome: "完成材料",
          status: "active",
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      [
        "task",
        "t",
        {
          title: "本周已完成",
          date: week.start,
          top: true,
          status: "done",
          projectId: "p",
          completedAt: week.start + "T12:00:00+08:00",
          actualMinutes: 30,
        },
      ],
      [
        "task",
        "next",
        { title: "复习下一章", date: week.end, status: "open", projectId: "p" },
      ],
      ["sleep", "s", { date: week.start, minutes: 380 }],
      ["body", "b", { date: week.start, weight: 57 }],
      ["body", "b2", { date: week.end, weight: 58 }],
      ["income", "i", { date: week.start, cents: 3200 }],
      ["client", "c", { added: week.start, grade: "D" }],
      ["deal", "d", { date: week.end, clientId: "c", cents: 55000 }],
    ];
    for (const [kind, id, data] of rows) await db.put(kind, data, id);
    return { rows: (await db.exportData()).rows, week };
  });
  await page.getByRole("link", { name: "每周", exact: true }).click();
  await expect(page.getByTestId("week-range")).toHaveText(
    before.week.start.replaceAll("-", "/") +
      " — " +
      before.week.end.replaceAll("-", "/"),
  );
  await expect(page.locator(".weekly-review")).toContainText("已记录 1/7 天");
  await expect(page.locator(".weekly-review")).toContainText("¥32.00");
  await expect(page.locator(".weekly-review")).toContainText("¥550.00");
  await expect(page.locator(".weekly-review")).toContainText("复习下一章");
  await page.getByRole("button", { name: "上周", exact: true }).click();
  await expect(page.getByTestId("week-range")).not.toContainText(
    before.week.end.replaceAll("-", "/"),
  );
  await expect(page.locator(".weekly-review")).toContainText("未记录");
  await page.getByRole("button", { name: "本周", exact: true }).click();
  await page.getByLabel("历史周内任一天").fill("2026-01-01");
  await expect(page.getByTestId("week-range")).toHaveText(
    "2025/12/29 — 2026/01/04",
  );
  await page.getByRole("button", { name: "本周", exact: true }).click();
  await page.getByLabel("本周最重要的推进是什么？").fill("完成一个章节");
  await page.getByLabel("本周最大阻碍是什么？").fill("资料不齐");
  await page.getByLabel("哪件事应该停止 / 减少？").fill("减少刷视频");
  await page.getByLabel("下周最重要的一件事是什么？").fill("完成考试复习");
  await page.getByRole("checkbox", { name: "考试复习 结果：通过期末" }).check();
  await page
    .getByRole("button", { name: "保存周复盘与下周重点", exact: true })
    .click();
  await expect(
    page.getByText("周复盘与下周重点已保存", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("下周最重要的一件事是什么？")).toHaveValue(
    "完成考试复习",
  );
  await expect(
    page.getByRole("checkbox", { name: "考试复习 结果：通过期末" }),
  ).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const after = await page.evaluate(async () =>
    (await import("/src/db.js")).exportData(),
  );
  expect(after.rows.filter((r) => r.kind !== "weeklyReview")).toEqual(
    before.rows,
  );
  expect(after.rows.filter((r) => r.kind === "weeklyReview")).toHaveLength(1);
  expect(after.rows.find((r) => r.kind === "weeklyReview").data).toMatchObject({
    weekStart: before.week.start,
    weekEnd: before.week.end,
    priorityProjectIds: ["p"],
  });
  expect(
    after.rows.find((r) => r.kind === "weeklyReview").data,
  ).not.toHaveProperty("stats");
  await page.screenshot({
    path: ".qa/weekly-" + info.project.name + ".png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "每日", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "每日小结", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
