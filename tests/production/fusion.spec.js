import { test, expect } from "@playwright/test";

test("warm fusion artwork and mobile controls survive Pages subpath refresh", async ({
  page,
}) => {
  const errors = [],
    missing = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      response.url().startsWith("http://127.0.0.1:4176")
    )
      missing.push(response.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem("action-cloud", JSON.stringify({ url: "", key: "" })),
  );
  await page.setViewportSize({ width: 360, height: 740 });
  for (const route of ["today", "projects", "data", "focus"]) {
    await page.goto("./#" + route);
    await expect(page.locator("main h1")).toBeVisible();
    await page.reload();
    await expect(page.locator("main h1")).toBeVisible();
    const art = page.locator("main .header-art").first();
    await expect(art).toBeVisible();
    expect(
      await art.evaluate(async (img) => {
        await img.decode();
        return img.naturalWidth;
      }),
    ).toBeGreaterThan(0);
    expect(await art.getAttribute("src")).toBe(
      "./illustrations/windowsill.webp",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});
