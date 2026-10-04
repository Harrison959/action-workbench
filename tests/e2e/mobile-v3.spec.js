import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }, info) => {
  test.skip(
    info.project.name !== "mobile",
    "Mobile-only foundation; desktop is covered by existing suites.",
  );
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
});
const nav = (page) => page.getByRole("navigation", { name: "手机导航" });
const root = async (page, name) => {
  await nav(page).getByRole("link", { name, exact: true }).click();
  await expect(
    nav(page).getByRole("link", { name, exact: true }),
  ).toHaveAttribute("aria-current", "page");
};
// Calls the same handler registered with Capacitor App; no injected swipe/touch listener.
const nativeBack = (page) =>
  page.evaluate(async () => {
    const { handleAppBack } = await import("/src/navigationHistory.js");
    return handleAppBack({
      minimize: () => {
        window.__minimized = true;
      },
    });
  });
const ready = (page, name) =>
  expect(page.locator("main")).toHaveAttribute("data-page", name);
const noOverflow = async (page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
async function touchTargets(locator) {
  const failures = await locator.evaluateAll((els) =>
    els.flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden")
        return [];
      return r.width >= 43.5 && r.height >= 43.5
        ? []
        : [
            {
              text: el.getAttribute("aria-label") || el.textContent.trim(),
              width: r.width,
              height: r.height,
            },
          ];
    }),
  );
  expect(failures).toEqual([]);
}

test("root tabs replace, secondary routes push, parent back and browser forward work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#today");
  await expect(page.locator("main h1")).toBeVisible();
  const initial = await page.evaluate(() => history.length);
  for (const name of ["项目", "复盘", "更多", "今天", "更多"])
    await root(page, name);
  expect(await page.evaluate(() => history.length)).toBe(initial);
  expect(await nativeBack(page)).toBe("root");
  expect(await page.evaluate(() => window.__minimized)).toBe(true);
  await expect(page).toHaveURL(/#more$/);
  await page.getByRole("link", { name: /设置与同步/ }).click();
  await ready(page, "settings");
  expect(await page.evaluate(() => history.length)).toBe(initial + 1);
  await page.getByRole("button", { name: "返回更多", exact: true }).click();
  await ready(page, "more");
  await page.goForward();
  await ready(page, "settings");
  await page.goBack();
  await ready(page, "more");
  await page.locator('.mobile-more a[href="#data"]').click();
  await ready(page, "data");
  expect(await nativeBack(page)).toBe("parent");
  await ready(page, "more");
  await page.locator('.mobile-more a[href="#data"]').click();
  await page
    .getByRole("link", { name: "打开睡眠时长原始记录", exact: true })
    .click();
  await ready(page, "sleep");
  await expect(
    nav(page).getByRole("link", { name: "更多", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "返回数据", exact: true }).click();
  await ready(page, "data");
  expect(errors).toEqual([]);
});

test("project detail has one title, returns to Projects, segmented options stay keyboard usable", async ({
  page,
}) => {
  await page.goto("/#projects");
  await page
    .getByRole("button", { name: "新建项目", exact: true })
    .first()
    .click();
  await page
    .getByLabel("项目名称")
    .fill("长项目名：完成本学期专业课重点章节复习与真题整理");
  await page.getByLabel("完成结果").fill("整理完重点章节和真题");
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(page).toHaveURL(/#projects\//);
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator(".topbar")).toBeHidden();
  await page.getByRole("button", { name: "返回项目", exact: true }).click();
  await expect(page).toHaveURL(/#projects$/);
  await page.locator(".project-list-row").click();
  expect(await nativeBack(page)).toBe("parent");
  await expect(page).toHaveURL(/#projects$/);
  await page.goForward();
  await expect(page).toHaveURL(/#projects\//);
  await page.getByRole("button", { name: "返回项目", exact: true }).click();
  await root(page, "更多");
  await page.goForward();
  await expect(page).toHaveURL(/#projects\//);
  expect(await nativeBack(page)).toBe("parent");
  await expect(page).toHaveURL(/#projects$/);
  const active = page.getByRole("tab", { name: "进行中", exact: true });
  await active.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "已暂停", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.setViewportSize({ width: 360, height: 740 });
  await touchTargets(
    page.locator(
      ".tabs button, .page-head button, .bottom-nav a, .bottom-nav button",
    ),
  );
  await noOverflow(page);
});

test("mobile dark palette and reduced motion remain usable", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("action-theme", "dark"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#more");
  await expect(page.locator("main h1")).toBeVisible();
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      bg: style.getPropertyValue("--app-bg").trim(),
      text: style.getPropertyValue("--text").trim(),
    };
  });
  expect(colors).toEqual({ bg: "#181f1b", text: "#e7eee8" });
  await nav(page).getByRole("button", { name: "添加", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await noOverflow(page);
  await page.screenshot({ path: ".qa/mobile-v3-dark-add.png" });
});

test("native modal-first back preserves form draft and focus; Add remains the central action", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#today");
  const add = nav(page).getByRole("button", { name: "添加", exact: true });
  await add.click();
  await expect(
    page.getByRole("dialog", { name: "添加", exact: true }),
  ).toBeVisible();
  expect(await nativeBack(page)).toBe("modal");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(add).toBeFocused();
  const create = page.getByRole("button", { name: "创建任务", exact: true });
  await create.click();
  await page.getByLabel("具体做什么").fill("关闭后保留的手机草稿");
  expect(await nativeBack(page)).toBe("modal");
  await expect(page).toHaveURL(/#today$/);
  await expect(create).toBeFocused();
  await create.click();
  await expect(page.getByLabel("具体做什么")).toHaveValue(
    "关闭后保留的手机草稿",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存记录", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("More has three groups, readable tokens and touch targets at 360px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/#more");
  await expect(page.locator(".mobile-more .more-group")).toHaveCount(3);
  for (const name of ["计划", "记录", "工具"])
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
  await expect(page.locator("main h1")).toHaveCount(1);
  await touchTargets(
    page.locator(".mobile-more a, .bottom-nav a, .bottom-nav button"),
  );
  const typography = await page.locator("main h1").evaluate((el) => ({
    size: getComputedStyle(el).fontSize,
    bg: getComputedStyle(document.documentElement)
      .getPropertyValue("--app-bg")
      .trim(),
  }));
  expect(typography).toEqual({ size: "26px", bg: "#f3f4ef" });
  const add = await page.locator(".add-primary-icon").boundingBox();
  expect(add.width).toBe(52);
  expect(add.height).toBe(52);
  const bar = await nav(page).boundingBox();
  expect(bar.y - add.y).toBeGreaterThanOrEqual(6);
  expect(bar.y - add.y).toBeLessThanOrEqual(8);
  await noOverflow(page);
  await page.screenshot({ path: ".qa/mobile-v3-more-360.png", fullPage: true });
  await page.locator('.mobile-more a[href="#data"]').click();
  await touchTargets(
    page.locator(
      ".tracker-line button, .tracker-line a, .mobile-page-back button, .tracker-details summary",
    ),
  );
  await noOverflow(page);
  await page.goto("/#today");
  await touchTargets(page.locator("main button, main a"));
});

test("short viewport and visual keyboard keep sheet content scrollable and save accessible", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 360, height: 540 });
  await page.goto("/#data");
  await page.getByRole("button", { name: "记录睡眠时长", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".sheet-handle")).toBeVisible();
  expect((await dialog.boundingBox()).width).toBe(360);
  expect(
    await dialog
      .locator(".sheet-content")
      .evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await touchTargets(dialog.locator("button"));
  // Chromium desktop cannot display an Android IME. Exercise its visualViewport contract explicitly.
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, "height", {
      configurable: true,
      value: 320,
    });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  const save = dialog.getByRole("button", { name: "保存记录", exact: true });
  await expect(save).toBeInViewport();
  const box = await save.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(321);
  await dialog.locator(".sheet-content").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(save).toBeInViewport();
  await page.screenshot({ path: ".qa/mobile-v3-keyboard-contract.png" });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "记录睡眠时长", exact: true }),
  ).toBeFocused();
  await noOverflow(page);
  expect(errors).toEqual([]);
});
