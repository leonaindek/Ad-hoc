"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { computeDurationMinutes, formatDuration, todayISO, formatDate } from "@/lib/dates";
import ProgressBar from "@/components/ProgressBar";
import type { Goal, Task, StudySession, StudyTimeGoal } from "@/types";

type GoalBreakdown = { title: string; minutes: number };

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  function toISO(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return { start: toISO(monday), end: toISO(sunday) };
}

function getFutureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  goals: Goal[];
  onToggleTask: (goalId: string, task: Task) => void;
};

function ShimmerBlock({ className }: { className: string }) {
  return <div className={`animate-shimmer rounded-lg ${className}`} />;
}

export default function DashboardCard({ goals, onToggleTask }: Props) {
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [weekBreakdown, setWeekBreakdown] = useState<GoalBreakdown[]>([]);
  const [studyGoal, setStudyGoal] = useState<StudyTimeGoal | null>(null);
  const [loading, setLoading] = useState(true);

  // Target input state
  const [showTargetInput, setShowTargetInput] = useState(false);
  const [targetHours, setTargetHours] = useState("");

  const today = todayISO();

  useEffect(() => {
    async function load() {
      try {
        const [sessions, studyGoals] = await Promise.all([
          api.getSessions(),
          api.getStudyTimeGoals(today),
        ]);

        // Today's study time
        const todaySessions = sessions.filter((s: StudySession) => s.date === today);
        let todayTotal = 0;
        for (const s of todaySessions) {
          const dur = computeDurationMinutes(s.startTime, s.endTime);
          if (dur > 0) todayTotal += dur;
        }
        setTodayMinutes(todayTotal);

        // Weekly study time + breakdown
        const goalMap = new Map<string, Goal>();
        for (const g of goals) goalMap.set(g.id, g);

        const { start, end } = getWeekRange();
        const weekSessions = sessions.filter(
          (s: StudySession) => s.date >= start && s.date <= end
        );

        let weekTotal = 0;
        const byGoal = new Map<string, number>();
        for (const s of weekSessions) {
          const dur = computeDurationMinutes(s.startTime, s.endTime);
          if (dur <= 0) continue;
          weekTotal += dur;
          byGoal.set(s.goalId, (byGoal.get(s.goalId) ?? 0) + dur);
        }
        setWeeklyTotal(weekTotal);
        setWeekBreakdown(
          Array.from(byGoal.entries()).map(([goalId, mins]) => ({
            title: goalMap.get(goalId)?.title ?? "Unknown",
            minutes: mins,
          }))
        );

        // Study time goal for today
        if (studyGoals.length > 0) {
          setStudyGoal(studyGoals[0]);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [today, goals]);

  // Collect incomplete tasks
  const incompleteTasks: { task: Task; goalId: string; goalTitle: string }[] = [];
  for (const goal of goals) {
    for (const task of goal.tasks) {
      if (!task.completed) {
        incompleteTasks.push({ task, goalId: goal.id, goalTitle: goal.title });
      }
    }
  }

  // Sort: due today first, then by soonest due date
  incompleteTasks.sort((a, b) => {
    const aDue = a.task.dueDate ?? "9999-12-31";
    const bDue = b.task.dueDate ?? "9999-12-31";
    const aIsToday = a.task.dueDate === today ? 0 : 1;
    const bIsToday = b.task.dueDate === today ? 0 : 1;
    if (aIsToday !== bIsToday) return aIsToday - bIsToday;
    return aDue.localeCompare(bDue);
  });

  const topTasks = incompleteTasks.slice(0, 3);
  const moreTasks = incompleteTasks.length - 3;

  // Upcoming deadlines (next 7 days)
  const weekAhead = getFutureDate(7);
  const upcomingDeadlines: { task: Task; goalTitle: string }[] = [];
  for (const goal of goals) {
    for (const task of goal.tasks) {
      if (!task.completed && task.dueDate && task.dueDate >= today && task.dueDate <= weekAhead) {
        upcomingDeadlines.push({ task, goalTitle: goal.title });
      }
    }
  }
  upcomingDeadlines.sort((a, b) => (a.task.dueDate ?? "").localeCompare(b.task.dueDate ?? ""));
  const shownDeadlines = upcomingDeadlines.slice(0, 5);
  const moreDeadlines = upcomingDeadlines.length - 5;

  async function handleSetTarget() {
    const hours = parseFloat(targetHours);
    if (isNaN(hours) || hours <= 0) return;
    try {
      const result = await api.createStudyTimeGoal({
        date: today,
        targetMinutes: Math.round(hours * 60),
      });
      setStudyGoal(result);
      setShowTargetInput(false);
      setTargetHours("");
    } catch {
      // silently fail
    }
  }

  async function handleRemoveTarget() {
    if (!studyGoal) return;
    try {
      await api.deleteStudyTimeGoal(studyGoal.id);
      setStudyGoal(null);
    } catch {
      // silently fail
    }
  }

  if (loading) {
    return (
      <div className="mb-6 rounded-xl border border-border bg-gradient-to-br from-surface-1 to-surface-2 p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <ShimmerBlock className="h-4 w-24" />
            <ShimmerBlock className="h-8 w-20" />
            <ShimmerBlock className="h-2 w-full" />
          </div>
          <div className="space-y-3">
            <ShimmerBlock className="h-4 w-24" />
            <ShimmerBlock className="h-8 w-20" />
            <ShimmerBlock className="h-4 w-full" />
            <ShimmerBlock className="h-4 w-3/4" />
          </div>
          <div className="space-y-3">
            <ShimmerBlock className="h-4 w-24" />
            <ShimmerBlock className="h-5 w-full" />
            <ShimmerBlock className="h-5 w-5/6" />
            <ShimmerBlock className="h-5 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-gradient-to-br from-surface-1 to-surface-2 p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Column 1: Today's Study Time */}
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Today&apos;s Study
          </h3>
          <p className="text-3xl font-bold text-foreground">
            {formatDuration(todayMinutes)}
          </p>

          {studyGoal ? (
            <div className="mt-2">
              <p className="mb-2 text-xs text-muted-foreground">
                of {formatDuration(studyGoal.targetMinutes)} target
              </p>
              <ProgressBar value={Math.min(todayMinutes / studyGoal.targetMinutes, 1)} />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    setTargetHours(String(studyGoal.targetMinutes / 60));
                    setShowTargetInput(true);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit target"
                >
                  Edit
                </button>
                <button
                  onClick={handleRemoveTarget}
                  className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                  title="Remove target"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : showTargetInput ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={targetHours}
                onChange={(e) => setTargetHours(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSetTarget(); if (e.key === "Escape") setShowTargetInput(false); }}
                placeholder="Hours"
                className="w-20 rounded-lg border border-border bg-surface-1 px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                autoFocus
              />
              <button
                onClick={handleSetTarget}
                className="rounded-lg bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent/90 transition-colors"
              >
                Set
              </button>
              <button
                onClick={() => setShowTargetInput(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTargetInput(true)}
              className="mt-3 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
            >
              Set daily target
            </button>
          )}
        </div>

        {/* Column 2: This Week */}
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            This Week
          </h3>
          <p className="text-3xl font-bold text-foreground">
            {formatDuration(weeklyTotal)}
          </p>
          <p className="mb-3 text-xs text-muted-foreground">total study time</p>

          {weekBreakdown.length > 0 && (
            <ul className="space-y-2">
              {weekBreakdown.map((b, i) => (
                <li key={b.title}>
                  {i > 0 && <div className="mb-2 border-t border-border" />}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate mr-2">{b.title}</span>
                    <span className="font-medium text-foreground whitespace-nowrap">
                      {formatDuration(b.minutes)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Column 3: Today's Tasks */}
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Today&apos;s Tasks
          </h3>

          {incompleteTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">All caught up!</p>
          ) : (
            <ul className="space-y-2">
              {topTasks.map(({ task, goalId, goalTitle }) => (
                <li key={task.id} className="flex items-start gap-2">
                  <button
                    onClick={() => onToggleTask(goalId, task)}
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border bg-surface-1 transition-colors hover:border-accent"
                  >
                    {task.completed && (
                      <svg className="h-3 w-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{goalTitle}</p>
                  </div>
                </li>
              ))}
              {moreTasks > 0 && (
                <li className="text-xs text-muted-foreground">
                  and {moreTasks} more...
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom row: Upcoming Deadlines */}
      {shownDeadlines.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Upcoming Deadlines
          </h3>
          <div className="flex flex-wrap items-center gap-x-1 text-sm text-foreground">
            {shownDeadlines.map((d, i) => (
              <span key={d.task.id}>
                {i > 0 && <span className="text-muted-foreground"> &middot; </span>}
                <span className="font-medium">{formatDate(d.task.dueDate!)}</span>
                <span className="text-muted-foreground"> &mdash; {d.task.title} ({d.goalTitle})</span>
              </span>
            ))}
            {moreDeadlines > 0 && (
              <span className="text-xs text-muted-foreground"> &middot; and {moreDeadlines} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
