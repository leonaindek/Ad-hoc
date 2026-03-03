"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import LockOverlay from "@/components/LockOverlay";
import { motivationalQuotes } from "@/components/motivationalQuotes";
import { api } from "@/lib/api";
import type { Goal, Task } from "@/types";

type Phase = "setup" | "running" | "completed";

export type SessionTask = { id: string; goalTitle: string; title: string; checked: boolean };

const PRESETS = [
  { label: "15 min", seconds: 15 * 60 },
  { label: "30 min", seconds: 30 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "2 hours", seconds: 2 * 60 * 60 },
];

export default function LockInView() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [showQuitModal, setShowQuitModal] = useState(false);

  // Goals & task selection
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [sessionTasks, setSessionTasks] = useState<SessionTask[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const endTimeRef = useRef(0);
  const quoteRef = useRef("");

  // Fetch goals on mount
  useEffect(() => {
    api.getGoals().then((g) => {
      setGoals(g);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const buildSessionTasks = useCallback((): SessionTask[] => {
    const tasks: SessionTask[] = [];
    for (const goal of goals) {
      for (const task of goal.tasks) {
        if (selectedTaskIds.has(task.id)) {
          tasks.push({
            id: task.id,
            goalTitle: goal.title,
            title: task.title,
            checked: false,
          });
        }
      }
    }
    return tasks;
  }, [goals, selectedTaskIds]);

  const toggleSessionTask = (id: string) => {
    setSessionTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, checked: !t.checked } : t))
    );
  };

  const startTimer = useCallback((seconds: number) => {
    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
    endTimeRef.current = Date.now() + seconds * 1000;
    setSessionTasks(buildSessionTasks());
    setPhase("running");
  }, [buildSessionTasks]);

  const handleStartCustom = () => {
    const h = parseInt(customHours) || 0;
    const m = parseInt(customMinutes) || 0;
    const total = h * 3600 + m * 60;
    if (total > 0) startTimer(total);
  };

  const handleQuitConfirm = () => {
    setShowQuitModal(false);
    setPhase("setup");
  };

  const handleStop = () => {
    quoteRef.current =
      motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    setShowQuitModal(true);
  };

  // Timer tick
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((endTimeRef.current - Date.now()) / 1000)
      );
      setRemainingSeconds(remaining);
      if (remaining <= 0) setPhase("completed");
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  // beforeunload guard
  useEffect(() => {
    if (phase !== "running") return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const customTotal = (parseInt(customHours) || 0) * 3600 + (parseInt(customMinutes) || 0) * 60;
  const minutesLeft = Math.ceil(remainingSeconds / 60);

  // Flat list of all incomplete tasks for the picker
  const allTasks: (Task & { goalTitle: string })[] = goals.flatMap((g) =>
    g.tasks.filter((t) => !t.completed).map((t) => ({ ...t, goalTitle: g.title }))
  );

  const filteredTasks = searchQuery.trim()
    ? allTasks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.goalTitle.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allTasks;

  if (phase === "running" || phase === "completed") {
    return (
      <LockOverlay
        remainingSeconds={remainingSeconds}
        totalSeconds={totalSeconds}
        completed={phase === "completed"}
        onStop={handleStop}
        onDone={() => {
          setPhase("setup");
          setSessionTasks([]);
        }}
        tasks={sessionTasks}
        onToggleTask={toggleSessionTask}
        showQuitModal={showQuitModal}
        onCloseQuitModal={() => setShowQuitModal(false)}
        onConfirmQuit={handleQuitConfirm}
        minutesLeft={minutesLeft}
        quoteText={quoteRef.current}
      />
    );
  }

  // Setup phase
  return (
    <div className="animate-fade-in mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lock In</h1>
        <p className="mt-1 text-sm text-muted">
          Choose a duration, pick tasks to focus on, and start your session.
        </p>
      </div>

      {/* Presets */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Quick start</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRESETS.map((p) => (
            <Button
              key={p.seconds}
              variant="secondary"
              onClick={() => startTimer(p.seconds)}
              className="py-3"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Custom duration</h2>
        <div className="flex items-end gap-3">
          <Input
            label="Hours"
            type="number"
            min={0}
            max={12}
            placeholder="0"
            value={customHours}
            onChange={(e) => setCustomHours(e.target.value)}
            className="w-24"
          />
          <Input
            label="Minutes"
            type="number"
            min={0}
            max={59}
            placeholder="0"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            className="w-24"
          />
          <Button
            variant="primary"
            disabled={customTotal === 0}
            onClick={handleStartCustom}
            className="py-2"
          >
            Start
          </Button>
        </div>
      </div>

      {/* Task picker from goals */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Session tasks</h2>
          {selectedTaskIds.size > 0 && (
            <span className="text-xs text-accent">
              {selectedTaskIds.size} selected
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Pick tasks from your goals to check off during the session.
        </p>

        {loading ? (
          <div className="py-4 text-center text-sm text-muted">Loading goals...</div>
        ) : allTasks.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-1 px-4 py-6 text-center text-sm text-muted">
            No incomplete tasks found. Create goals and tasks on the Dashboard first.
          </div>
        ) : (
          <>
            {allTasks.length > 5 && (
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            )}
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-1 p-2">
              {filteredTasks.map((task) => {
                const selected = selectedTaskIds.has(task.id);
                return (
                  <button
                    key={task.id}
                    onClick={() => toggleTaskSelection(task.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? "bg-accent-soft"
                        : "hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                        selected
                          ? "border-accent bg-accent text-white"
                          : "border-border"
                      }`}
                    >
                      {selected && (
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">
                        {task.title}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {task.goalTitle}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredTasks.length === 0 && (
                <div className="py-3 text-center text-xs text-muted">
                  No tasks match your search.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
