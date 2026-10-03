import test from "node:test";
import assert from "node:assert/strict";
import {
  PRIMARY_NAV,
  parseRoute,
  navigationGroup,
  mobileGroup,
} from "../src/navigation.js";

test("navigation has seven primary entries and Today is the default", () => {
  assert.equal(PRIMARY_NAV.length, 7);
  assert.equal(parseRoute("").page, "today");
  assert.equal(parseRoute("#not-a-route").page, "today");
});
test("legacy links and notification destinations remain reachable", () => {
  assert.equal(parseRoute("#schedule").page, "calendar");
  assert.equal(parseRoute("#summary").page, "review");
  for (const page of [
    "tasks",
    "focus",
    "plan",
    "goals",
    "cover",
    "settings",
    "income",
    "sales",
    "sleep",
    "courses",
    "english",
    "fitness",
    "guitar",
    "emotion",
    "inbox",
  ]) {
    assert.equal(parseRoute("#" + page).page, page);
  }
  assert.equal(navigationGroup("sleep"), "data");
  assert.equal(navigationGroup("focus"), "today");
  assert.equal(mobileGroup("calendar"), "more");
});
test("project detail and archived filter survive URL parsing", () => {
  assert.equal(parseRoute("#projects/a%2Fb").id, "a/b");
  assert.equal(
    parseRoute("#projects?status=archived").query.get("status"),
    "archived",
  );
  assert.doesNotThrow(() => parseRoute("#projects/%bad"));
});
