import test from "node:test";
import assert from "node:assert/strict";
import { parentRoute, parseRoute, mobileGroup } from "../src/navigation.js";
import {
  navigate,
  installRouteHistory,
  backToParent,
  handleAppBack,
} from "../src/navigationHistory.js";

// An actual stack, including forward entries and legacy hash events; not a call-count mock.
function browser({ small = true, hash = "#today" } = {}) {
  const win = new EventTarget();
  win.Event = Event;
  win.matchMedia = () => ({ matches: small });
  const stack = [
    { url: "https://example.test/action-workbench/" + hash, state: null },
  ];
  let cursor = 0;
  win.location = {};
  Object.defineProperties(win.location, {
    hash: { get: () => new URL(stack[cursor].url).hash },
    href: { get: () => stack[cursor].url },
  });
  const write = (state, url, replace) => {
    const item = { state, url: new URL(url, win.location.href).href };
    if (replace) stack[cursor] = item;
    else {
      stack.splice(cursor + 1);
      stack.push(item);
      cursor++;
    }
  };
  const move = (delta) => {
    if (cursor + delta < 0 || cursor + delta >= stack.length) return;
    cursor += delta;
    win.dispatchEvent(new Event("hashchange"));
  };
  win.history = {
    get state() {
      return stack[cursor].state;
    },
    get length() {
      return stack.length;
    },
    pushState: (state, _title, url) => write(state, url, false),
    replaceState: (state, _title, url) => write(state, url, true),
    back: () => move(-1),
    forward: () => move(1),
  };
  win.legacyHash = (value) => {
    write(null, value, false);
    win.dispatchEvent(new Event("hashchange"));
  };
  installRouteHistory(win);
  return win;
}

test("mobile tabs replace one level, desktop links keep browser history", () => {
  for (const small of [true, false]) {
    const win = browser({ small });
    for (const to of [
      "projects",
      "review",
      "more",
      "today",
      "projects?status=archived",
    ])
      navigate(to, { win });
    assert.equal(win.history.length, small ? 1 : 6);
    assert.equal(win.location.hash, "#projects?status=archived");
  }
});
test("secondary pages push; parent back and browser forward preserve detail", () => {
  const win = browser({ hash: "#projects" });
  navigate("projects/p1", { win });
  assert.equal(win.history.length, 2);
  assert.equal(backToParent(win), true);
  assert.equal(win.location.hash, "#projects");
  win.history.forward();
  assert.equal(win.location.hash, "#projects/p1");
});
test("all secondary pages have centralized parents and active mobile groups", () => {
  const groups = {
    today: ["tasks", "plan", "goals", "focus", "cover"],
    more: ["settings", "data", "calendar", "inbox", "insights", "sales"],
    data: [
      "sleep",
      "income",
      "fitness",
      "courses",
      "english",
      "guitar",
      "emotion",
    ],
    projects: ["projects/id"],
  };
  for (const [parent, paths] of Object.entries(groups))
    for (const path of paths) {
      const route = parseRoute("#" + path);
      assert.equal(parentRoute(route).to, parent, path);
      assert.equal(
        mobileGroup(route.page),
        parent === "data" ? "more" : parent,
        path,
      );
    }
  for (const tab of ["today", "projects", "review", "more"])
    assert.equal(parentRoute(parseRoute("#" + tab)), null);
});
test("a root replaced after browser back cannot make project parent back go to More", () => {
  const win = browser({ hash: "#projects" });
  navigate("projects/p1", { win });
  win.history.back();
  navigate("more", { win });
  win.history.forward();
  assert.equal(win.location.hash, "#projects/p1");
  backToParent(win);
  assert.equal(win.location.hash, "#projects");
});
test("direct legacy hashes back to parent without leaving the Pages subpath", () => {
  for (const [hash, expected] of [
    ["#sleep", "#data"],
    ["#schedule", "#more"],
    ["#settings", "#more"],
  ]) {
    const win = browser({ hash });
    backToParent(win);
    assert.equal(win.location.hash, expected);
    assert.match(win.location.href, /\/action-workbench\/#/);
    assert.equal(win.history.length, 1);
  }
});
test("legacy route changes remain tracked; browser back/forward and native parent agree", () => {
  const win = browser({ hash: "#more" });
  win.legacyHash("#data");
  win.legacyHash("#sleep");
  backToParent(win);
  assert.equal(win.location.hash, "#data");
  win.history.back();
  assert.equal(win.location.hash, "#more");
  win.history.forward();
  assert.equal(win.location.hash, "#data");
});
test("native back closes a modal first, including a busy form that consumes cancel", async () => {
  const win = browser({ hash: "#settings" }),
    modal = new EventTarget();
  let canceled = false,
    minimized = false;
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    canceled = true;
  });
  const result = await handleAppBack({
    win,
    doc: { querySelector: () => modal },
    minimize: () => {
      minimized = true;
    },
  });
  assert.equal(result, "modal");
  assert.equal(canceled, true);
  assert.equal(win.location.hash, "#settings");
  assert.equal(minimized, false);
});
test("native back navigates secondary parents, then minimizes any root without tab rewind", async () => {
  const win = browser({ hash: "#more" }),
    doc = { querySelector: () => null };
  let minimized = 0;
  const minimize = () => {
    minimized++;
  };
  navigate("settings", { win });
  assert.equal(await handleAppBack({ win, doc, minimize }), "parent");
  assert.equal(win.location.hash, "#more");
  for (const tab of ["today", "projects", "review", "more"]) {
    navigate(tab, { win });
    assert.equal(await handleAppBack({ win, doc, minimize }), "root");
    assert.equal(win.location.hash, "#" + tab);
  }
  assert.equal(minimized, 4);
});
