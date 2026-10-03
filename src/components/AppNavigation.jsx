import { projectEditor } from "../features/projects/editor";
import React, { useEffect, useRef } from "react";
import { Icon, Link, useApp } from "../ui";
import {
  PRIMARY_NAV,
  navigationGroup,
  mobileGroup,
  pageTitle,
} from "../navigation";
import { today } from "../domain";
import { taskEditor, eventEditor } from "../pages/CorePages";

export function AppNavigation({ page, onAdd }) {
  const a = useApp();
  const group = navigationGroup(page);
  return (
    <>
      <aside className="sidebar">
        <Link to="today" className="brand">
          <img src="./logo.jpg" alt="松鹤" />
          <span>小松工作台</span>
        </Link>
        <button className="capture-button" onClick={a.capture}>
          <Icon name="Plus" />
          快速记录
        </button>
        <nav className="side-nav" aria-label="主导航">
          {PRIMARY_NAV.map(([id, label, icon], index) => (
            <Link
              key={id}
              to={id}
              className={`${group === id ? "active" : ""} ${index === 4 ? "nav-secondary-start" : ""}`}
              aria-current={group === id ? "page" : undefined}
            >
              <Icon name={icon} />
              {label}
              {id === "inbox" && (
                <small>
                  {a.list("inbox").filter((r) => r.status === "open").length ||
                    ""}
                </small>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p role="status">
            <i className="status-dot" />
            {a.syncText}
          </p>
        </div>
      </aside>
      <header className="topbar">
        <span className="topbar-path">
          小松工作台 <i>/</i> {pageTitle(page)}
        </span>
        <Link className="mobile-brand" to="today">
          <img src="./logo.jpg" alt="松鹤" />
          小松
        </Link>
        <div className="topbar-actions">
          <span className="desktop-only">{today()}</span>
          <button className="icon-button" onClick={onAdd} aria-label="添加">
            <Icon name="Plus" />
          </button>
          <Link to="more" className="avatar" aria-label="更多功能">
            松
          </Link>
        </div>
      </header>
    </>
  );
}
export function MobileNavigation({ page, onAdd }) {
  const selected = mobileGroup(page);
  return (
    <nav className="bottom-nav" aria-label="手机导航">
      {[
        ["today", "今天", "House"],
        ["projects", "项目", "FolderKanban"],
        ["add", "添加", "Plus"],
        ["review", "复盘", "NotebookPen"],
        ["more", "更多", "Grid2X2"],
      ].map(([id, label, icon]) =>
        id === "add" ? (
          <button key={id} onClick={onAdd} aria-label="添加">
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ) : (
          <Link
            key={id}
            to={id}
            className={selected === id ? "active" : ""}
            aria-current={selected === id ? "page" : undefined}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
export function AddMenu({ onClose }) {
  const a = useApp(),
    ref = useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    const cancel = (e) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", cancel);
    return () => el.removeEventListener("cancel", cancel);
  }, []);
  const act = (fn) => {
    onClose();
    fn();
  };
  return (
    <dialog
      ref={ref}
      className="dialog add-menu"
      aria-labelledby="add-title"
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-top">
        <h2 id="add-title">添加</h2>
        <button className="icon-button" aria-label="关闭" onClick={onClose}>
          <Icon name="X" />
        </button>
      </div>
      <div className="add-options">
        <button
          className="menu-row"
          onClick={() => act(() => projectEditor(a))}
        >
          <Icon name="FolderKanban" />
          <span>新建项目</span>
        </button>
        <button className="menu-row" onClick={() => act(() => taskEditor(a))}>
          <Icon name="ListTodo" />
          <span>新建任务</span>
        </button>
        <button className="menu-row" onClick={() => act(a.capture)}>
          <Icon name="Inbox" />
          <span>快速记录到收件箱</span>
        </button>
        <button className="menu-row" onClick={() => act(() => eventEditor(a))}>
          <Icon name="CalendarDays" />
          <span>添加日程</span>
        </button>
        <Link to="data" className="menu-row" onClick={onClose}>
          <Icon name="ChartNoAxesCombined" />
          <span>记录数据</span>
        </Link>
      </div>
    </dialog>
  );
}
