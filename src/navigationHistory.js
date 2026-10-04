import { isMobileTab, parentRoute, parseRoute } from "./navigation.js";

const STATE_KEY = "xiaosongNavigation";
const hashFor = (to) => "#" + String(to).replace(/^#/, "");
const currentHash = (win) => win.location.hash || "#today";
const mobile = (win) => win.matchMedia("(max-width: 760px)").matches;
let sequence = 0;
const entryKey = () => Date.now().toString(36) + ":" + ++sequence;
const knownEntries = new WeakMap();
function remember(win, meta) {
  if (!knownEntries.has(win)) knownEntries.set(win, new Map());
  knownEntries.get(win).set(meta.key, meta.hash);
}

function writeState(win, mode, hash, meta) {
  win.history[mode + "State"](
    { ...win.history.state, [STATE_KEY]: meta },
    "",
    hash,
  );
  remember(win, meta);
}
function signal(win) {
  win.dispatchEvent(new win.Event("hashchange"));
}
function entry(win) {
  const hash = currentHash(win),
    existing = win.history.state?.[STATE_KEY];
  if (existing?.hash === hash) {
    remember(win, existing);
    return existing;
  }
  const meta = { key: entryKey(), hash, previous: null };
  writeState(win, "replace", win.location.href, meta);
  return meta;
}

// Keep native hash links (old bookmarks, notification routes and legacy editors).
// Their new entries receive only navigation metadata, never business payloads.
export function installRouteHistory(win = window) {
  let last = entry(win);
  const changed = () => {
    const hash = currentHash(win),
      existing = win.history.state?.[STATE_KEY];
    if (existing?.hash === hash) {
      remember(win, existing);
      last = existing;
      return;
    }
    const meta = {
      key: entryKey(),
      hash,
      previous: { key: last.key, hash: last.hash },
    };
    writeState(win, "replace", win.location.href, meta);
    last = meta;
  };
  win.addEventListener("hashchange", changed);
  return () => win.removeEventListener("hashchange", changed);
}

export function navigate(to, { replace = false, win = window } = {}) {
  const hash = hashFor(to),
    previous = entry(win);
  if (hash === currentHash(win)) return;
  const sameLevel = mobile(win) && isMobileTab(parseRoute(hash));
  const mode = replace || sameLevel ? "replace" : "push";
  writeState(win, mode, hash, {
    key: mode === "replace" ? previous.key : entryKey(),
    hash,
    previous:
      mode === "replace"
        ? previous.previous
        : { key: previous.key, hash: previous.hash },
  });
  // push/replaceState do not emit hashchange; existing subscribers use this signal.
  signal(win);
}

export function backToParent(win = window) {
  const parent = parentRoute(parseRoute(currentHash(win)));
  if (!parent) return false;
  const previous = win.history.state?.[STATE_KEY]?.previous;
  const knownHash = previous && knownEntries.get(win)?.get(previous.key);
  const priorRoute = knownHash && parseRoute(knownHash);
  // Preserve browser forward when the real preceding entry is the parent.
  if (priorRoute && !priorRoute.id && priorRoute.page === parent.to)
    win.history.back();
  else {
    // A replaced root can invalidate a child's old parent hint. After reload,
    // the preceding entry cannot be inspected: replace with the known parent.
    const hint = !knownHash && previous && parseRoute(previous.hash);
    const destination =
      hint && !hint.id && hint.page === parent.to ? previous.hash : parent.to;
    navigate(destination, { replace: true, win });
  }
  return true;
}

export async function handleAppBack({
  win = window,
  doc = document,
  minimize,
} = {}) {
  const modal = doc.querySelector("dialog[open]");
  if (modal) {
    // FormDialog's existing cancel handler also keeps the saving lock intact.
    modal.dispatchEvent(new win.Event("cancel", { cancelable: true }));
    return "modal";
  }
  if (backToParent(win)) return "parent";
  // All four main tabs are roots. Never rewind through their historical visits.
  await minimize?.();
  return "root";
}
