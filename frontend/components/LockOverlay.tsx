"use client";

import Button from "@/components/ui/Button";
import type { SessionTask } from "@/components/LockInView";

type LockOverlayProps = {
  remainingSeconds: number;
  totalSeconds: number;
  completed: boolean;
  onStop: () => void;
  onDone: () => void;
  tasks: SessionTask[];
  onToggleTask: (id: string) => void;
  showQuitModal: boolean;
  onCloseQuitModal: () => void;
  onConfirmQuit: () => void;
  minutesLeft: number;
  quoteText: string;
};

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function TaskList({
  tasks,
  onToggle,
  dimmed,
}: {
  tasks: SessionTask[];
  onToggle: (id: string) => void;
  dimmed?: boolean;
}) {
  if (tasks.length === 0) return null;

  const doneCount = tasks.filter((t) => t.checked).length;

  return (
    <div className={`w-full max-w-sm ${dimmed ? "opacity-60" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Tasks
        </span>
        <span className="text-xs text-white/40">
          {doneCount}/{tasks.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              onClick={() => onToggle(task.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                  task.checked
                    ? "border-green-500 bg-green-500/20"
                    : "border-white/20"
                }`}
              >
                {task.checked && (
                  <svg
                    className="h-3 w-3 text-green-400"
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
                <span
                  className={`block truncate transition-colors ${
                    task.checked ? "text-white/30 line-through" : "text-white/80"
                  }`}
                >
                  {task.title}
                </span>
                <span className="block truncate text-xs text-white/30">
                  {task.goalTitle}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LockOverlay({
  remainingSeconds,
  totalSeconds,
  completed,
  onStop,
  onDone,
  tasks,
  onToggleTask,
  showQuitModal,
  onCloseQuitModal,
  onConfirmQuit,
  minutesLeft,
  quoteText,
}: LockOverlayProps) {
  const elapsed = totalSeconds - remainingSeconds;
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;

  // SVG progress ring
  const size = 240;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  if (completed) {
    const doneCount = tasks.filter((t) => t.checked).length;
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-[#0c0f1a] to-[#1a1040]">
        <div className="animate-scale-in flex flex-col items-center gap-6">
          {/* Checkmark */}
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500/20">
            <svg
              className="h-12 w-12 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white">Session complete!</h2>
          <p className="text-lg text-white/60">
            You focused for {formatTime(totalSeconds)}
          </p>
          {tasks.length > 0 && (
            <p className="text-sm text-white/40">
              {doneCount}/{tasks.length} task{tasks.length !== 1 ? "s" : ""} completed
            </p>
          )}
          <TaskList tasks={tasks} onToggle={onToggleTask} dimmed />
          <Button variant="primary" onClick={onDone} className="mt-4 px-8 py-3 text-base">
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-[#0c0f1a] to-[#1a1040]">
      <div className="flex flex-col items-center gap-8">
        {/* Progress ring + countdown */}
        <div className="relative flex items-center justify-center">
          <svg width={size} height={size} className="-rotate-90">
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={stroke}
            />
            {/* Progress arc */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <span className="absolute font-mono text-7xl font-light tracking-wider text-white">
            {formatTime(remainingSeconds)}
          </span>
        </div>

        {/* Pulsing dot */}
        <div className="flex items-center gap-2 text-white/40">
          <span className="animate-pulse-dot inline-block h-2 w-2 rounded-full bg-accent" />
          <span className="text-sm">Locked in</span>
        </div>

        {/* Tasks checklist */}
        <TaskList tasks={tasks} onToggle={onToggleTask} />

        {/* Stop button */}
        <Button
          variant="ghost"
          onClick={onStop}
          className="mt-4 text-white/40 hover:text-white/70 hover:bg-white/5"
        >
          Stop session
        </Button>
      </div>

      {/* Quit confirmation modal — rendered inside the overlay so it shares z-[100] */}
      {showQuitModal && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseQuitModal();
          }}
        >
          <div className="animate-slide-up-modal w-full max-w-md rounded-2xl bg-surface-1 p-6 shadow-2xl border border-border">
            <h3 className="text-lg font-semibold text-foreground">
              Are you sure?
            </h3>
            <p className="mt-2 text-sm text-muted">
              You still have {minutesLeft} minute{minutesLeft !== 1 ? "s" : ""}{" "}
              left. Don&apos;t break your streak!
            </p>
            <p className="mt-3 text-sm italic text-accent">
              &ldquo;{quoteText}&rdquo;
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={onCloseQuitModal}>
                Keep going
              </Button>
              <Button variant="danger" onClick={onConfirmQuit}>
                Yes, stop
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
