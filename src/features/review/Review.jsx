import React from "react";
import { useApp, Link } from "../../ui";
import { Summary } from "../../pages/CorePages";
import { WeeklyReview } from "./weekly/WeeklyReview";
export function Review() {
  const app = useApp(),
    weekly = app.route.query.get("view") === "weekly";
  return (
    <>
      <nav className="review-tabs" aria-label="复盘周期">
        <Link to="review" aria-current={!weekly ? "page" : undefined}>
          每日
        </Link>
        <Link
          to="review?view=weekly"
          aria-current={weekly ? "page" : undefined}
        >
          每周
        </Link>
      </nav>
      {weekly ? <WeeklyReview /> : <Summary />}
    </>
  );
}
