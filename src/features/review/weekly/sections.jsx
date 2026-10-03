import React from "react";
import { Link } from "../../../ui";
import { money } from "../../../domain.js";
import { projectPath } from "../../projects/model.js";
export const minutes = (value) =>
  value === null
    ? "未记录"
    : `${Math.floor(Math.round(value) / 60)}小时${Math.round(value) % 60}分`;
const amount = (value) => (value === null ? "未记录" : money(value));
function Line({ label, children }) {
  return (
    <div className="weekly-line">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function Block({ title, children }) {
  return (
    <section className="weekly-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function WeeklySections({ summary: s }) {
  const task = s.tasks,
    latest = s.weight.latest;
  return (
    <>
      <Block title="本周概览">
        <dl>
          <Line label="本周完成任务">
            {task.completed} 项
            {task.crossWeekDone > 0 &&
              `（含 ${task.crossWeekDone} 项跨周／未排期任务）`}
          </Line>
          <Line label="计划内本周完成">
            {task.plannedDone} / {task.planned} 项 · 完成率{" "}
            {task.completionRate === null
              ? "暂无计划"
              : Math.round(task.completionRate * 100) + "%"}
          </Line>
          <Line label="Top 3 本周完成">
            {task.topDone} / {task.top} 项
          </Line>
          <Line label="Focus 总时长">无法精确统计</Line>
          <Line label="有活动的项目">{s.activeProjectCount} 个</Line>
        </dl>
        <p className="weekly-note">
          计划和重点按当前任务日期与标记统计，排除取消；完成按实际完成日期统计。改期、重开后历史会随当前记录变化。
          {task.undatedDone > 0 &&
            `有 ${task.undatedDone} 个已完成计划任务缺少完成时间，未计入本周完成。`}
        </p>
      </Block>
      <Block title="项目推进">
        {s.projects.length === 0 && <p>本周未见带日期的项目推进记录。</p>}
        {s.projects.map((p) => (
          <article className="weekly-project" key={p.id}>
            <h3>
              <Link to={projectPath(p.id)}>{p.title}</Link>
            </h3>
            <p>
              本周完成 {p.completedTasks} 项任务 · 新增笔记 {p.newNotes} 条
              {p.completedStatus && " · 有项目完成记录"}
            </p>
            <p>
              当前关联任务：{p.progress.done} / {p.progress.total} ·
              当前下一步：{p.nextAction || "未指定有效任务"}
            </p>
            {p.noActivitySevenDays && (
              <p>截至 {p.reference}，最近 7 天未见推进记录。</p>
            )}
          </article>
        ))}
        <details>
          <summary>
            所选周未见活动的当前进行中项目：{s.inactiveProjects.length} 个
          </summary>
          {s.inactiveProjects.map((p) => (
            <p key={p.id}>
              <Link to={projectPath(p.id)}>{p.title}</Link>
              {p.noActivitySevenDays
                ? ` · 截至 ${p.reference}，7 天未见推进记录`
                : " · 所选周未见推进记录"}
            </p>
          ))}
        </details>
        <p className="weekly-note">
          活动依据：任务完成、新增项目笔记、项目完成日期。暂停／重开没有历史时间记录；项目状态与总进度展示当前值，历史周不还原当时状态。
        </p>
      </Block>
      <Block title="时间投入">
        <dl>
          <Line label="本周 Focus">无法还原历史会话</Line>
          <Line label="完成任务的累计专注">
            {minutes(s.focus.completedTaskMinutes)} · {s.focus.recordedTasks}{" "}
            个任务有记录
          </Line>
          {[
            ["study.minutes", "专业课"],
            ["english.minutes", "英语（观看＋阅读）"],
            ["workout.minutes", "运动"],
            ["guitar.minutes", "吉他"],
          ].map(([id, name]) => (
            <Line label={name} key={id}>
              {minutes(s.durations[id].value)} · 已记录{" "}
              {s.durations[id].recordedDays}/7 天
            </Line>
          ))}
        </dl>
        <p className="weekly-note">
          任务累计专注可能跨周，不等于本周
          Focus。各项学习、训练记录可能与专注重叠，不能直接相加成总投入。
        </p>
      </Block>
      <Block title="身体与生活">
        <dl>
          <Line label="平均睡眠">
            {minutes(s.sleep.value)} · 已记录 {s.sleep.recordedDays}/7 天
          </Line>
          <Line label="本周最后记录的体重">
            {latest ? latest.value + " kg · " + latest.date : "未记录"}
            {latest?.uncertainOrder && "（同日测量先后未知）"}
          </Line>
          <Line label="体重首末变化">
            {s.weight.change === null
              ? "记录不足或同日先后未知，暂不计算"
              : `${Number(s.weight.change.toFixed(2)) > 0 ? "+" : ""}${Number(s.weight.change.toFixed(2))} kg · ${s.weight.first.date} → ${latest.date}`}
          </Line>
          <Line label="运动时长">
            {minutes(s.durations["workout.minutes"].value)}
          </Line>
          <Line label="情绪记录">
            {s.emotion.entries} 条 · 已记录 {s.emotion.recordedDays}/7 天
          </Line>
          {s.emotion.latest && (
            <Line label="最后记录的状态">
              {s.emotion.latest.selected?.label || "状态未填"} · 强度{" "}
              {s.emotion.latest.value}/5
              {s.emotion.latest.uncertainOrder && "（同日先后未知）"}
            </Line>
          )}
        </dl>
        <p className="weekly-note">
          平均值只计算有效记录日。体重需要两个不同日期且首末测量无排序歧义；情绪强度不解释为好坏。
        </p>
      </Block>
      <Block title="收入与销售">
        <dl>
          <Line label="公众号已录收入">
            {amount(s.income.value)} · 已记录 {s.income.recordedDays}/7 天
          </Line>
          <Line label="新增登记客户">{s.sales.newClients} 位</Line>
          <Line label="完成的客户跟进任务">{s.sales.followups} 项</Line>
          <Line label="成交客户">
            {s.sales.deals} 位 · {s.sales.dealRecords} 条成交记录
          </Line>
          <Line label="销售已录收入">{amount(s.sales.income)}</Line>
        </dl>
        <p className="weekly-note">
          公众号按 income，客户按首次接触日期，成交按 deal
          日期；跟进仅统计已完成且关联客户的任务，不是完整沟通次数。
          {s.sales.missingAmountRecords > 0 &&
            `有 ${s.sales.missingAmountRecords} 条成交记录缺少有效金额。`}
          金额来自已登记样本，不表示已全部填齐。
        </p>
      </Block>
      <Block title="事实记录">
        <ul className="weekly-facts">
          {s.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Block>
    </>
  );
}
