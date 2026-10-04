import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useApp, Icon } from "../../ui";
import { buildCommands } from "./commands.js";
import {
  searchCommands,
  isCommandShortcut,
  isMacPlatform,
  nextIndex,
} from "./search.js";
import { executeCommand } from "./actions";
import "./command.css";
const Controls = createContext(null);
const platform = () => navigator.userAgentData?.platform || navigator.platform;
export function CommandTrigger() {
  const controls = useContext(Controls);
  return (
    <button
      type="button"
      className="command-trigger"
      onClick={controls.open}
      disabled={controls.disabled}
      aria-label="打开命令中心"
      aria-keyshortcuts={isMacPlatform(platform()) ? "Meta+K" : "Control+K"}
    >
      <Icon name="Search" size={16} />
      <span>搜索与命令</span>
      <kbd>{isMacPlatform(platform()) ? "⌘ K" : "Ctrl K"}</kbd>
    </button>
  );
}
export function CommandCenter({ children, disabled = false }) {
  const app = useApp(),
    [opened, setOpened] = useState(false);
  const returnTo = useRef(null);
  const destination = useRef(null);
  const queueFocus = (item) => {
    destination.current =
      item.type === "project"
        ? { page: "projects", id: item.project.id }
        : item.operation === "navigate"
          ? { page: item.route }
          : item.operation === "focus"
            ? { page: "focus" }
            : null;
  };
  useLayoutEffect(() => {
    const target = destination.current;
    if (
      opened ||
      !target ||
      app.route.page !== target.page ||
      (app.route.id || null) !== (target.id || null)
    )
      return;
    // A lazy route may mount after this effect. Watch only until its heading exists.
    const focusHeading = () => {
      const heading = document.querySelector("#main h1");
      if (!heading || !heading.getClientRects().length) return false;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      destination.current = null;
      return true;
    };
    if (focusHeading()) return;
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect();
    });
    observer.observe(document.getElementById("main"), {
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [app.route, opened]);
  const restore = () => {
    if (returnTo.current?.isConnected)
      returnTo.current.focus({ preventScroll: true });
  };
  const close = (returnFocus = true) => {
    document.querySelector("dialog.command-dialog[open]")?.close();
    setOpened(false);
    if (returnFocus) restore();
  };
  const open = () => {
    if (disabled || document.querySelector("dialog[open]")) return;
    returnTo.current = document.activeElement;
    setOpened(true);
  };
  useEffect(() => {
    const keydown = (event) => {
      if (
        !window.matchMedia("(min-width: 801px)").matches ||
        !isCommandShortcut(event, platform())
      )
        return;
      if (
        !opened &&
        (disabled ||
          document.querySelector("dialog[open]") ||
          event.target.closest?.(
            'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
          ))
      )
        return;
      event.preventDefault();
      if (opened) close();
      else open();
    };
    const hashchange = () => close(false);
    window.addEventListener("keydown", keydown);
    window.addEventListener("hashchange", hashchange);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("hashchange", hashchange);
    };
  }, [opened, disabled]);
  return (
    <Controls.Provider value={{ open, disabled }}>
      {children}
      {opened && (
        <Palette
          app={app}
          close={close}
          restore={restore}
          queueFocus={queueFocus}
        />
      )}
    </Controls.Provider>
  );
}
function Palette({ app, close, restore, queueFocus }) {
  const [query, setQuery] = useState(""),
    [selection, setSelection] = useState(0);
  const dialog = useRef(),
    input = useRef(),
    executing = useRef(false);
  const id = useId();
  const items = searchCommands(
    query,
    buildCommands(app),
    app.list("project"),
    app.list("task"),
  );
  const selected = Math.min(selection, Math.max(0, items.length - 1));
  useEffect(() => {
    const el = dialog.current;
    el.showModal();
    input.current.focus();
    return () => {
      el.close();
    };
  }, []);
  useEffect(() => {
    document
      .getElementById(id + "-" + selected)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected, query, items.length]);
  async function execute(item) {
    if (!item || executing.current) return;
    executing.current = true;
    queueFocus(item);
    // Release the modal before opening an existing editor. Native dialog restores focus.
    dialog.current.close();
    restore();
    close(false);
    try {
      await executeCommand(item, {
        ...app,
        edit: (spec) => app.edit({ ...spec, focusFirst: true }),
      });
    } catch (e) {
      queueFocus({});
      app.notify(e.message || "操作失败，请重试");
    }
  }
  function keydown(event) {
    if (
      event.target !== input.current ||
      event.isComposing ||
      event.keyCode === 229
    )
      return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelection(
        nextIndex(selected, event.key === "ArrowDown" ? 1 : -1, items.length),
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute(items[selected]);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="command-dialog"
      aria-labelledby={id + "-title"}
      onKeyDown={keydown}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
    >
      <div className="command-search">
        <h2 id={id + "-title"} className="command-sr">
          命令中心
        </h2>
        <Icon name="Search" size={19} />
        <input
          ref={input}
          role="combobox"
          aria-label="搜索命令、项目或任务"
          aria-expanded="true"
          aria-controls={id + "-results"}
          aria-autocomplete="list"
          aria-activedescendant={items.length ? id + "-" + selected : undefined}
          value={query}
          placeholder="搜索命令、项目或未完成任务"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelection(0);
          }}
        />
        <button
          className="icon-button"
          aria-label="关闭命令中心"
          onClick={() => close()}
        >
          <Icon name="X" size={17} />
        </button>
      </div>
      <div
        className="command-results"
        id={id + "-results"}
        role="listbox"
        aria-label="搜索结果"
      >
        {items.map((item, index) => (
          <React.Fragment key={item.key}>
            {(index === 0 || items[index - 1].type !== item.type) && (
              <div role="presentation" className="command-group">
                {
                  { command: "命令", project: "项目", task: "未完成任务" }[
                    item.type
                  ]
                }
              </div>
            )}
            <div
              role="option"
              id={id + "-" + index}
              aria-selected={index === selected}
              className={
                "command-option " + (index === selected ? "selected" : "")
              }
              onMouseMove={() => setSelection(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => execute(item)}
            >
              <span>{item.label}</span>
              {item.detail && <small>{item.detail}</small>}
            </div>
          </React.Fragment>
        ))}
        {!items.length && (
          <p className="command-empty" role="status">
            没有匹配的命令、项目或未完成任务
          </p>
        )}
      </div>
      <footer className="command-hints">
        <span>↑ ↓ 选择</span>
        <span>Enter 执行</span>
        <span>Esc 关闭</span>
      </footer>
    </dialog>
  );
}
