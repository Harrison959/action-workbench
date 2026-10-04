import React, {
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import { Icons } from "./icons";
import { parentRoute } from "./navigation";
import { navigate, backToParent } from "./navigationHistory";
export const Context = createContext(null);
export const useApp = () => useContext(Context);
export function Icon({ name = "ArrowUpRight", size = 19, ...props }) {
  const C = Icons[name] || Icons.Circle;
  return <C size={size} strokeWidth={1.6} {...props} />;
}
export function Button({
  children,
  icon,
  secondary = false,
  small = false,
  ...props
}) {
  return (
    <button
      className={`button ${secondary ? "secondary" : ""} ${small ? "small" : ""}`}
      {...props}
    >
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  );
}
export function Link({
  to,
  children,
  className = "",
  onClick,
  replace = false,
  ...props
}) {
  return (
    <a
      href={"#" + to}
      className={className}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target ||
          props.download
        )
          return;
        event.preventDefault();
        navigate(to, { replace });
      }}
    >
      {children}
    </a>
  );
}
export function PageHead({ eyebrow, title, description, action }) {
  const app = useApp();
  const parent = app?.route && parentRoute(app.route);
  return (
    <header className="page-head mobile-page-header">
      {parent && (
        <div className="mobile-page-back">
          <button
            type="button"
            onClick={() => backToParent()}
            aria-label={"返回" + parent.label}
          >
            <Icon name="ChevronLeft" size={22} />
            <span>{parent.label}</span>
          </button>
        </div>
      )}
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Section({ title, label, action, children, className = "" }) {
  return (
    <section className={"section " + className}>
      <div className="section-head">
        <div>
          {label && <span className="eyebrow">{label}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title = "还没有记录",
  text = "从今天的第一条开始。",
  action,
  icon = "Feather",
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Tabs({ items, value, onChange, appearance = "tabs" }) {
  const refs = useRef([]);
  const select = (index) => {
    onChange(items[index].id || items[index]);
    refs.current[index]?.focus();
  };
  return (
    <div
      className={"tabs" + (appearance === "segmented" ? " segmented" : "")}
      role="tablist"
      aria-label="切换视图"
    >
      {items.map((i, index) => (
        <button
          key={i.id || i}
          role="tab"
          ref={(el) => {
            refs.current[index] = el;
          }}
          tabIndex={value === (i.id || i) ? 0 : -1}
          onKeyDown={(e) => {
            const next =
              e.key === "ArrowRight"
                ? (index + 1) % items.length
                : e.key === "ArrowLeft"
                  ? (index - 1 + items.length) % items.length
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? items.length - 1
                      : null;
            if (next !== null) {
              e.preventDefault();
              select(next);
            }
          }}
          aria-selected={value === (i.id || i)}
          className={value === (i.id || i) ? "active" : ""}
          onClick={() => onChange(i.id || i)}
        >
          {i.name || i}
        </button>
      ))}
    </div>
  );
}
export function Stats({ items }) {
  return (
    <div className="stats">
      {items.map(([label, value, caption]) => (
        <div className="stat" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          {caption && <small>{caption}</small>}
        </div>
      ))}
    </div>
  );
}
export function Chart({ points, label = "趋势", unit = "" }) {
  points = points.map((p) => ({
    ...p,
    value: Number.isFinite(p.value) ? p.value : null,
  }));
  const values = points.filter(
    (p) => p.value !== null && Number.isFinite(p.value),
  );
  if (!values.length)
    return (
      <Empty
        title="记录后，趋势会出现在这里"
        text="未填写的日期留空，零值正常显示。"
        icon="ChartNoAxesCombined"
      />
    );
  const max = Math.max(...values.map((p) => p.value), 1),
    min = Math.min(0, ...values.map((p) => p.value));
  const x = (i) => 36 + (i * 640) / Math.max(points.length - 1, 1),
    y = (v) => 170 - ((v - min) / (max - min)) * 140;
  const segments = [];
  let segment = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else segment.push([x(i), y(p.value)]);
  });
  if (segment.length) segments.push(segment);
  return (
    <div className="chart">
      <svg viewBox="0 0 720 208" role="img" aria-label={label}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="36"
              y1={30 + t * 140}
              x2="676"
              y2={30 + t * 140}
              className="gridline"
            />
            <text x="0" y={34 + t * 140}>
              {Math.round(max - (max - min) * t)}
            </text>
          </g>
        ))}
        {segments.map((s, i) => (
          <polyline
            key={i}
            points={s.map((p) => p.join(",")).join(" ")}
            fill="none"
            className="chart-line"
          />
        ))}
        {points.map(
          (p, i) =>
            p.value !== null && (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r="3"
                className="chart-dot"
              >
                <title>
                  {p.date || p.label}：{p.value}
                  {unit}
                </title>
              </circle>
            ),
        )}
        {points
          .filter(
            (_, i) =>
              i === 0 ||
              i === points.length - 1 ||
              i % Math.ceil(points.length / 6) === 0,
          )
          .map((p) => (
            <text
              key={points.indexOf(p)}
              x={x(points.indexOf(p))}
              y="202"
              textAnchor="middle"
            >
              {p.label}
            </text>
          ))}
      </svg>
      <details>
        <summary>查看具体数据</summary>
        <div className="data-grid">
          {points.map((p, i) => (
            <span key={i}>
              {p.date || p.label}
              <b>{p.value === null ? "未记录" : p.value + unit}</b>
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}
export function RecordList({ rows, render, empty, edit, onRemove }) {
  return rows.length ? (
    <div className="record-list">
      {rows.map((r) => (
        <article className="record" key={r.id}>
          <div className="record-content">{render(r)}</div>
          <div className="row-actions">
            {edit && (
              <button
                className="icon-button"
                aria-label="编辑记录"
                onClick={() => edit(r)}
              >
                <Icon name="Pencil" size={16} />
              </button>
            )}
            {onRemove && (
              <button
                className="icon-button"
                aria-label="移入回收站"
                onClick={() => onRemove(r.id)}
              >
                <Icon name="Archive" size={16} />
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty text={empty} />
  );
}
export function useSheetViewport(ref) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      const el = ref.current;
      if (!el) return;
      el.style.setProperty(
        "--sheet-viewport-height",
        (viewport?.height || innerHeight) + "px",
      );
      el.style.setProperty(
        "--sheet-bottom-inset",
        Math.max(
          0,
          innerHeight -
            ((viewport?.height || innerHeight) + (viewport?.offsetTop || 0)),
        ) + "px",
      );
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
    };
  }, [ref]);
}
export function FormDialog({ spec, onClose }) {
  const dialog = useRef(),
    saving = useRef(false),
    errorRef = useRef(),
    key = "action-draft:" + spec.key;
  useSheetViewport(dialog);
  const [values, setValues] = useState(() => {
      try {
        const d = JSON.parse(sessionStorage.getItem(key));
        return { ...spec.initial, ...d };
      } catch {
        return { ...spec.initial };
      }
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    const el = dialog.current;
    if (spec.focusFirst)
      el.querySelector("form input, form textarea, form select")?.focus();
    const cancel = (e) => {
      e.preventDefault();
      if (!saving.current) onClose();
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(values));
    } catch {}
  }, [values, key]);
  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
      errorRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [error]);
  async function save(e) {
    e.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await spec.save(values);
      try {
        sessionStorage.removeItem(key);
      } catch {}
      onClose();
    } catch (e) {
      setError(e.message || "保存失败，请重试");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="dialog form-dialog"
      aria-labelledby="form-dialog-title"
      onClick={(e) => {
        if (e.target === dialog.current && !saving.current) onClose();
      }}
    >
      <div className="sheet-handle" aria-hidden="true" />
      <div className="dialog-top">
        <div>
          <h2 id="form-dialog-title">{spec.title}</h2>
        </div>
        <button
          onClick={onClose}
          disabled={busy}
          className="icon-button"
          aria-label="关闭"
        >
          <Icon name="X" />
        </button>
      </div>
      <form
        className="sheet-form"
        onSubmit={save}
        aria-busy={busy}
        aria-describedby={error ? "form-error" : undefined}
      >
        <div className="sheet-content">
          <div className="form-fields">
            {spec.description && <p className="muted">{spec.description}</p>}
            {spec.fields.map((f) => {
              if (f.show && !f.show(values)) return null;
              const common = {
                id: "f-" + f.name,
                name: f.name,
                required: f.required,
                disabled: busy,
                value: values[f.name] ?? "",
                onChange: (e) =>
                  setValues((v) => ({ ...v, [f.name]: e.target.value })),
                min: f.min,
                max: f.max,
                step: f.step || (f.type === "number" ? "any" : undefined),
                placeholder: f.placeholder,
                autoComplete: f.autoComplete || "off",
              };
              return (
                <label
                  key={f.name}
                  className={"field " + (f.wide ? "wide" : "")}
                  htmlFor={common.id}
                >
                  <span>
                    {f.label}
                    {f.required && <i> *</i>}
                  </span>
                  {f.type === "select" ? (
                    <select {...common}>
                      {(f.options || []).map((o) => (
                        <option key={o.value ?? o} value={o.value ?? o}>
                          {o.label ?? o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea {...common} rows={3} />
                  ) : f.type === "checkbox" ? (
                    <input
                      type="checkbox"
                      disabled={busy}
                      id={common.id}
                      checked={!!values[f.name]}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.name]: e.target.checked }))
                      }
                    />
                  ) : (
                    <input
                      {...common}
                      type={f.type || "text"}
                      inputMode={f.type === "number" ? "decimal" : undefined}
                    />
                  )}{" "}
                  {f.help && <small>{f.help}</small>}
                </label>
              );
            })}
          </div>
          {error && (
            <p
              className="error"
              role="alert"
              id="form-error"
              ref={errorRef}
              tabIndex={-1}
            >
              {error}
            </p>
          )}
        </div>
        <div className="form-footer">
          <small>关闭后保留本次草稿</small>
          <Button
            type="submit"
            disabled={busy}
            icon={busy ? "LoaderCircle" : "Check"}
          >
            {busy ? "正在保存…" : spec.submit || "保存记录"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
export const textField = (name, label, extra = {}) => ({
  name,
  label,
  ...extra,
});
export const dateField = (name = "date", label = "记录日期", extra = {}) => ({
  name,
  label,
  type: "date",
  required: true,
  ...extra,
});
export const numberField = (name, label, extra = {}) => ({
  name,
  label,
  type: "number",
  min: 0,
  ...extra,
});
export const noteField = (name = "note", label = "备注", extra = {}) => ({
  name,
  label,
  type: "textarea",
  wide: true,
  ...extra,
});
