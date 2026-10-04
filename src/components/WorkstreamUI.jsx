import React, { useMemo } from "react";
import { useApp, PageHead, Stats, Section, Icon, Chart } from "../ui";
import { STREAMS, today, addDays, money } from "../domain";
import { createTrackerReader } from "../features/trackers/selectors";

const icons = {
  income: "Wallet",
  sales: "Users",
  sleep: "Moon",
  courses: "GraduationCap",
  english: "BookOpen",
  fitness: "Dumbbell",
  guitar: "Music",
  emotion: "Heart",
};
export function WorkstreamHeader({ id, action }) {
  const stream = STREAMS.find((s) => s.id === id);
  return (
    <PageHead
      title={
        <>
          <span className={"domain-icon domain-" + id}>
            <Icon name={icons[id]} />
          </span>
          {stream.name}
        </>
      }
      action={action}
    />
  );
}
export function CompactStats({ items }) {
  return (
    <div className="compact-stats">
      <Stats items={items} />
    </div>
  );
}
export function RecordSection(props) {
  return (
    <Section
      {...props}
      label={undefined}
      className={"record-section " + (props.className || "")}
    />
  );
}

// Presentation only: use the existing reader and original business records.
export function WorkstreamSnapshot({ id }) {
  const a = useApp(),
    date = today(),
    month = date.slice(0, 7) + "-01";
  const reader = useMemo(() => createTrackerReader(a.rows), [a.rows]);
  const daily = (key) => reader.getDailyValue(key, date).value;
  const total = (key) => {
    const valid = reader
      .getRangeValues(key, month, date)
      .filter((d) => !d.missing);
    return valid.length ? valid.reduce((n, d) => n + d.value, 0) : null;
  };
  const minutes = (v) => (v === null ? "未记录" : v + " 分钟");
  if (id === "income") {
    const amount = (v) => (v === null ? "未记录" : money(v));
    const points = reader
      .getRangeValues("income.amount", addDays(date, -6), date)
      .map((d) => ({
        label: d.date.slice(5),
        value: d.value === null ? null : d.value / 100,
      }));
    return (
      <>
        <CompactStats
          items={[
            ["今日收入", amount(daily("income.amount"))],
            ["本月已录", amount(total("income.amount"))],
          ]}
        />
        <details className="snapshot-trend">
          <summary>最近 7 日收入</summary>
          <Chart points={points} unit="元" />
        </details>
      </>
    );
  }
  if (id === "sales") {
    const clients = a.list("client"),
      deals = [...a.list("deal")]
        .filter((d) => d.date)
        .sort((a, b) => b.date.localeCompare(a.date));
    return (
      <CompactStats
        items={[
          [
            "今日及逾期待跟进",
            clients.filter((c) => c.next && c.next <= date).length + " 位",
          ],
          ["已登记客户", clients.length + " 位"],
          [
            "最近成交",
            deals[0] ? money(deals[0].cents) : "未记录",
            deals[0]?.date,
          ],
        ]}
      />
    );
  }
  if (id === "guitar")
    return (
      <CompactStats
        items={[
          ["今日练习", minutes(daily("guitar.minutes"))],
          ["本月练习时长", minutes(total("guitar.minutes"))],
        ]}
      />
    );
  if (id === "fitness") {
    const last = [...a.list("workout")]
      .filter((r) => r.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return (
      <CompactStats
        items={[
          ["今日训练", minutes(daily("workout.minutes"))],
          ["最近训练", last?.part || "未记录", last?.date],
        ]}
      />
    );
  }
  if (id === "emotion") {
    const last = [...a.list("emotion")]
      .filter((r) => r.date)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          String(b.time || "").localeCompare(String(a.time || "")),
      )[0];
    return (
      <div className="emotion-latest">
        <Icon name="Heart" />
        <div>
          <small>最近状态{last?.date ? " · " + last.date : ""}</small>
          <h2>{last?.mood || "还没有记录"}</h2>
          <p>
            {last?.intensity
              ? "强度 " + last.intensity + " / 5"
              : "选择状态，再留下触发和调整。"}
          </p>
        </div>
      </div>
    );
  }
  return null;
}
