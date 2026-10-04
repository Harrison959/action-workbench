import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});
const save = async (page) => {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存记录", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
};
const go = async (page, route) => {
  await page.evaluate((route) => {
    location.hash = route;
  }, route);
  await expect(page.locator("main")).toHaveAttribute(
    "data-page",
    route.split(/[/?]/)[0],
  );
  await expect(page.locator("main h1")).toBeVisible();
};
const noOverflow = async (page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);

test("a real day: decide, focus, project, body, study, capture, review and reload", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#today");
  await page.getByRole("button", { name: "创建任务", exact: true }).click();
  await page.getByLabel("具体做什么").fill("完成组织胚胎复习");
  await page.getByLabel("放入当天 Top 3").check();
  await save(page);
  await expect(page.locator(".today-top")).toContainText("完成组织胚胎复习");
  await page
    .locator(".today-next")
    .getByRole("button", { name: "开始专注", exact: true })
    .click();
  await expect(page).toHaveURL(/#focus$/);
  await page.getByRole("button", { name: "结束并记录" }).click();
  await page.getByLabel("这个任务已经完成").check();
  await page.getByLabel("完成结果 / 下一步").fill("完成第一章");
  await save(page);
  await expect(page.locator(".today-top .done")).toContainText(
    "完成组织胚胎复习",
  );
  const add =
    info.project.name === "mobile"
      ? page
          .getByRole("navigation", { name: "手机导航" })
          .getByRole("button", { name: "添加", exact: true })
      : page
          .locator(".topbar")
          .getByRole("button", { name: "添加", exact: true });
  await add.click();
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByLabel("项目名称").fill("本学期期末复习");
  await page.getByLabel("完成结果").fill("完成所有重点章节");
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "本学期期末复习", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关联已有任务", exact: true }).click();
  await save(page);
  await expect(page.locator(".project-task")).toContainText("完成组织胚胎复习");
  // Mobile reaches Data through the existing More link.
  if (info.project.name === "mobile") {
    await page
      .getByRole("navigation", { name: "手机导航" })
      .getByRole("link", { name: "更多", exact: true })
      .click();
    await page.locator('.mobile-more a[href="#data"]').click();
  } else
    await page
      .getByRole("navigation", { name: "主导航" })
      .getByRole("link", { name: "数据", exact: true })
      .click();
  await page.getByRole("button", { name: "记录体重", exact: true }).click();
  await page.getByLabel("体重（kg）").fill("57.3");
  await save(page);
  await expect(
    page.locator('[data-tracker="body.weight"] .tracker-value'),
  ).toHaveText("57.3 kg");
  await page
    .getByRole("button", { name: "记录专业课学习时长", exact: true })
    .click();
  await page.getByLabel("复习章节 / 知识点").fill("上皮组织");
  await page.getByLabel("复习分钟").fill("45");
  await save(page);
  await expect(
    page.locator('[data-tracker="study.minutes"] .tracker-value'),
  ).toHaveText("45 分钟");
  await go(page, "today");
  await page.getByLabel("快速记录内容").fill("查找下一章练习题");
  await page.getByRole("button", { name: "记下", exact: true }).click();
  await expect(page.getByLabel("快速记录内容")).toHaveValue("");
  await page
    .getByRole("navigation", {
      name: info.project.name === "mobile" ? "手机导航" : "主导航",
      exact: true,
    })
    .getByRole("link", { name: "复盘", exact: true })
    .click();
  await page.getByRole("link", { name: "每周", exact: true }).click();
  await page
    .getByLabel("本周最重要的推进是什么？")
    .fill("完成第一章并整理资料");
  await page.getByLabel("下周最重要的一件事是什么？").fill("完成第二章");
  await page
    .getByRole("button", { name: "保存周复盘与下周重点", exact: true })
    .click();
  await expect(
    page.getByText("周复盘与下周重点已保存", { exact: true }),
  ).toBeVisible();
  await go(page, "more");
  await page.getByRole("link", { name: /值得注意/ }).click();
  await expect(
    page.getByRole("heading", { name: "值得注意", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "值得注意", exact: true }),
  ).toBeVisible();
  const rows = await page.evaluate(async () =>
    (await import("/src/db.js")).records(),
  );
  const task = rows.find((r) => r.kind === "task");
  expect(task).toMatchObject({
    status: "done",
    top: true,
    title: "完成组织胚胎复习",
  });
  expect(task.projectId).toBe(rows.find((r) => r.kind === "project").id);
  expect(rows.find((r) => r.kind === "body").weight).toBe("57.3");
  expect(rows.find((r) => r.kind === "study").minutes).toBe("45");
  expect(rows.find((r) => r.kind === "inbox").text).toBe("查找下一章练习题");
  expect(rows.find((r) => r.kind === "weeklyReview").nextMain).toBe(
    "完成第二章",
  );
  expect(rows.some((r) => ["trackerEntry", "insight"].includes(r.kind))).toBe(
    false,
  );
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("360px all pages with long legacy records, empty states and a short form viewport", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 360, height: 740 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#today");
  for (const route of [
    "today",
    "projects",
    "data",
    "review?view=weekly",
    "insights",
    "calendar",
    "inbox",
  ]) {
    await go(page, route);
    await noOverflow(page);
    await expect(page.locator("main")).not.toContainText(
      /undefined|NaN|\b0\s*\/\s*0\b/,
    );
  }
  await page.evaluate(async () => {
    const db = await import("/src/db.js"),
      { today, addDays } = await import("/src/domain.js");
    const date = today(),
      long = "很长的中文记录与英文LongUnbrokenText".repeat(12);
    const records = [
      [
        "project",
        {
          title: long,
          outcome: long,
          status: "active",
          createdAt: addDays(date, -30) + "T00:00:00+08:00",
        },
        "long-project",
      ],
      [
        "task",
        {
          title: long,
          date,
          minutes: 25,
          top: true,
          status: "open",
          projectId: "long-project",
        },
        "long-task",
      ],
      ["inbox", { text: long, date, status: "open" }, "long-inbox"],
      [
        "event",
        { title: long, start: date + "T14:00", note: long },
        "long-event",
      ],
      ["account", { name: long, track: "测试", start: date }, "long-account"],
      [
        "income",
        { date, cents: 12345, accountId: "long-account" },
        "long-income",
      ],
      [
        "client",
        { name: long, school: long, grade: "A", next: date, note: long },
        "long-client",
      ],
      [
        "study",
        {
          date,
          subject: "组织与胚胎学",
          topic: long,
          minutes: 20,
          material: long,
        },
        "long-study",
      ],
      [
        "guitar",
        { date, content: long, song: long, minutes: 10 },
        "long-guitar",
      ],
      [
        "emotion",
        { date, mood: "低落", intensity: 3, trigger: long },
        "long-emotion",
      ],
      [
        "workout",
        { date, part: long, exercises: long, minutes: 25 },
        "long-workout",
      ],
      ["body", { date, weight: 57 }, "long-body"],
      [
        "episode",
        { date, season: 1, episode: 1, minutes: 20, note: long },
        "long-episode",
      ],
      ["sleep", { date, minutes: 400, note: long }, "long-sleep"],
    ];
    for (const [kind, data, id] of records) await db.put(kind, data, id);
  });
  for (const route of [
    "today",
    "projects",
    "projects/long-project",
    "tasks",
    "focus",
    "calendar",
    "review",
    "review?view=weekly",
    "insights",
    "data",
    "inbox",
    "more",
    "income",
    "sales",
    "sleep",
    "courses",
    "english",
    "fitness",
    "guitar",
    "emotion",
  ]) {
    await go(page, route);
    await noOverflow(page);
    await expect(page.locator("main")).not.toContainText(/undefined|NaN/);
    // Mobile V3: real legacy rows must not bring back undersized controls/captions.
    const tiny = await page.locator("main").evaluate((main) =>
      [...main.querySelectorAll("*")].flatMap((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return [];
        const text = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .some((n) => n.textContent.trim());
        const smallText =
          text && parseFloat(getComputedStyle(el).fontSize) < 12;
        const smallTarget =
          el.matches("button,a,summary") && (r.width < 43.5 || r.height < 43.5);
        return smallText || smallTarget ? [el.className || el.tagName] : [];
      }),
    );
    expect(tiny, route + " small text/target").toEqual([]);
  }
  await go(page, "review?view=weekly");
  await page
    .getByLabel("本周最重要的推进是什么？")
    .fill("长篇复盘内容".repeat(600));
  await noOverflow(page);
  await go(page, "data");
  await page.getByRole("button", { name: "记录体重", exact: true }).click();
  await page.setViewportSize({ width: 360, height: 360 });
  await page.getByLabel("体重（kg）").fill("58");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存记录", exact: true })
    .scrollIntoViewIfNeeded();
  await noOverflow(page);
  await save(page);
  expect(errors).toEqual([]);
});

test("legacy missing dates and invalid values stay readable without rewriting records", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#data");
  const before = await page.evaluate(async () => {
    const db = await import("/src/db.js");
    for (const kind of [
      "sleep",
      "body",
      "workout",
      "guitar",
      "income",
      "deal",
      "study",
      "episode",
      "reading",
    ])
      await db.put(
        kind,
        { minutes: "invalid", weight: "invalid", cents: "invalid" },
        "legacy-" + kind,
      );
    await db.put("event", { title: "旧日程没有时间" }, "legacy-event");
    await db.put(
      "task",
      { title: "已取消", status: "cancelled" },
      "legacy-task",
    );
    await db.put(
      "project",
      { title: "归档项目", status: "archived" },
      "legacy-project",
    );
    await db.put(
      "project",
      { title: "暂停项目", status: "paused" },
      "legacy-paused",
    );
    await db.put("body", { weight: 99 }, "deleted-body");
    await db.remove("deleted-body");
    return await db.exportData();
  });
  for (const route of [
    "data",
    "sleep",
    "fitness",
    "guitar",
    "income",
    "sales",
    "courses",
    "english",
    "today",
    "projects",
    "calendar",
    "review?view=weekly",
    "insights",
  ]) {
    await go(page, route);
    await expect(
      page.getByText("页面暂时无法打开", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/NaN|undefined/);
    await noOverflow(page);
  }
  const after = await page.evaluate(async () =>
    (await import("/src/db.js")).exportData(),
  );
  expect(after.rows).toEqual(before.rows);
  expect(errors).toEqual([]);
});

test("forms retain drafts, announce validation errors, restore focus and tabs use arrows", async ({
  page,
}) => {
  await page.goto("/#data");
  const trigger = page.getByRole("button", { name: "记录体重", exact: true });
  await trigger.click();
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("至少记录一项测量");
  await expect(page.getByRole("alert")).toBeFocused();
  await page.getByLabel("体重（kg）").fill("58");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByLabel("体重（kg）")).toHaveValue("58");
  await page.evaluate(() => {
    window.originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "records")
        throw new DOMException(
          "存储空间不足，请释放空间后重试",
          "QuotaExceededError",
        );
      return window.originalPut.apply(this, args);
    };
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存记录", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("存储空间不足");
  await expect(page.getByLabel("体重（kg）")).toHaveValue("58");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.originalPut;
  });
  await save(page);
  await go(page, "tasks");
  const first = page.getByRole("tab", { name: "今天", exact: true });
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "即将到来", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "即将到来", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
