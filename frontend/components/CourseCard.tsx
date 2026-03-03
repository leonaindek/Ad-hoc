"use client";

import { useState, useRef } from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { Course, Goal, Period, CoursePart, GradingMode, UpdateCoursePayload } from "@/types";
import { computeProgress } from "@/lib/progress";
import ProgressBar from "@/components/ProgressBar";
import Button from "@/components/ui/Button";

type DragHandleProps = {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
};

type CourseCardProps = {
  course: Course;
  goals: Goal[];
  allCourses: Course[];
  allPeriods?: Period[];
  allSemesters?: { id: string; name: string; year: number; order: number }[];
  /** When set, the card is rendered inside a period context — x button unassigns instead of deleting */
  periodContext?: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, payload: UpdateCoursePayload) => void;
  dragHandleProps?: DragHandleProps;
};

const GRADE_COLORS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  B: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  C: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  D: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  E: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  F: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  P: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
};

const LETTER_GRADES = ["A", "B", "C", "D", "E", "F"];
const PF_GRADES = ["P", "F"];
const ALL_GOAL_GRADES = ["A", "B", "C", "D", "E", "F", "P"];

function courseHasFailed(course: Course): { failed: boolean; failedParts: string[] } {
  const failedParts: string[] = [];
  if (course.parts && course.parts.length > 0) {
    for (const p of course.parts) {
      if (p.grade === "F") failedParts.push(p.name);
    }
  } else if (course.grade === "F") {
    failedParts.push(course.title);
  }
  return { failed: failedParts.length > 0, failedParts };
}

export default function CourseCard({
  course,
  goals,
  allCourses,
  allPeriods = [],
  allSemesters = [],
  periodContext,
  onDelete,
  onUpdate,
  dragHandleProps,
}: CourseCardProps) {
  const [minimised, setMinimised] = useState(false);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(course.title);
  const [editingCredits, setEditingCredits] = useState(false);
  const [creditsDraft, setCreditsDraft] = useState(String(course.credits));
  const [editingGrade, setEditingGrade] = useState(false);
  const [editingMode, setEditingMode] = useState(false);
  const [gradingGoalId, setGradingGoalId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const creditsInputRef = useRef<HTMLInputElement>(null);

  const hasParts = course.parts && course.parts.length > 0;
  const courseGoals = goals.filter((g) => course.goalIds.includes(g.id));
  const colorClass = GRADE_COLORS[course.grade] ?? "bg-gray-100 text-gray-700";
  const goalGrades = course.goalGrades ?? {};
  const gradeOptions = course.gradingMode === "letter" ? LETTER_GRADES : PF_GRADES;
  const { failed, failedParts } = courseHasFailed(course);

  // Goals available to add: not already claimed by any course
  const claimedGoalIds = new Set(allCourses.flatMap((c) => c.goalIds));
  const availableGoals = goals.filter((g) => !claimedGoalIds.has(g.id));

  // --- X button handler ---
  function handleXButton() {
    if (periodContext) {
      // Unassign from this period
      if (hasParts) {
        // Remove periodId from parts in this period
        const newParts = course.parts!.map((p) =>
          p.periodId === periodContext ? { ...p, periodId: undefined } : p
        );
        onUpdate(course.id, { parts: newParts });
      } else {
        onUpdate(course.id, { periodId: null });
      }
    } else {
      onDelete(course.id);
    }
  }

  function startEditingTitle() {
    setTitleDraft(course.title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 0);
  }

  function commitTitle() {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== course.title) {
      onUpdate(course.id, { title: trimmed });
    }
    setEditingTitle(false);
  }

  function startEditingCredits() {
    setCreditsDraft(String(course.credits));
    setEditingCredits(true);
    setTimeout(() => creditsInputRef.current?.select(), 0);
  }

  function commitCredits() {
    const num = Number(creditsDraft);
    if (num > 0 && num !== course.credits) {
      onUpdate(course.id, { credits: num });
    }
    setEditingCredits(false);
  }

  function handleGradeChange(grade: string) {
    onUpdate(course.id, { grade: grade as Course["grade"] });
    setEditingGrade(false);
  }

  function handleModeChange(mode: GradingMode) {
    const newGrade = mode === "letter" ? "A" : "P";
    onUpdate(course.id, { gradingMode: mode, grade: newGrade as Course["grade"] });
    setEditingMode(false);
  }

  function handleAddGoal(goalId: string) {
    onUpdate(course.id, { goalIds: [...course.goalIds, goalId] });
    setShowGoalPicker(false);
  }

  function handleRemoveGoal(goalId: string) {
    const newGoalGrades = { ...goalGrades };
    delete newGoalGrades[goalId];
    onUpdate(course.id, { goalIds: course.goalIds.filter((id) => id !== goalId), goalGrades: newGoalGrades });
  }

  function handleSetGoalGrade(goalId: string, grade: string) {
    onUpdate(course.id, { goalGrades: { ...goalGrades, [goalId]: grade } });
    setGradingGoalId(null);
  }

  // --- Period assignment (whole course or split) ---
  function handlePeriodChange(value: string) {
    if (value === "__split__") {
      handleSplitIntoParts();
    } else {
      onUpdate(course.id, { periodId: value || null });
    }
  }

  function handleSplitIntoParts() {
    const initialPart: CoursePart = {
      id: crypto.randomUUID(),
      name: "Part 1",
      credits: course.credits,
      gradingMode: course.gradingMode,
      grade: course.grade,
      periodId: course.periodId ?? undefined,
    };
    onUpdate(course.id, { periodId: null, parts: [initialPart] });
  }

  function handleMergeToWhole() {
    onUpdate(course.id, { parts: null });
  }

  // --- Part management ---
  function updatePart(partId: string, updates: Partial<CoursePart>) {
    if (!course.parts) return;
    const newParts = course.parts.map((p) =>
      p.id === partId ? { ...p, ...updates } : p
    );
    onUpdate(course.id, { parts: newParts });
  }

  function addPart() {
    const existing = course.parts ?? [];
    const newPart: CoursePart = {
      id: crypto.randomUUID(),
      name: `Part ${existing.length + 1}`,
      credits: 1,
      gradingMode: "letter",
      grade: "A",
    };
    onUpdate(course.id, { parts: [...existing, newPart] });
  }

  function removePart(partId: string) {
    if (!course.parts) return;
    const newParts = course.parts.filter((p) => p.id !== partId);
    if (newParts.length === 0) {
      onUpdate(course.id, { parts: null });
    } else {
      onUpdate(course.id, { parts: newParts });
    }
  }

  // Build period select options for reuse
  function renderPeriodOptions() {
    return allSemesters
      .sort((a, b) => a.order - b.order)
      .map((sem) => {
        const semPeriods = allPeriods
          .filter((p) => p.semesterId === sem.id)
          .sort((a, b) => a.order - b.order);
        return (
          <optgroup key={sem.id} label={`${sem.name} — Year ${sem.year}`}>
            {semPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        );
      });
  }

  return (
    <div className={`animate-slide-up flex flex-col gap-3 rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow duration-200 ${
      failed
        ? "border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10"
        : "border-border bg-surface-1"
    }`}>
      {/* Fail warning */}
      {failed && (
        <div className="flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <span className="text-sm">!!!</span>
          <span>
            FAILED — {failedParts.length === 1
              ? `"${failedParts[0]}" received F`
              : `${failedParts.length} parts received F: ${failedParts.map(n => `"${n}"`).join(", ")}`
            }
          </span>
        </div>
      )}

      {/* Header: drag handle + collapse + editable title + x button */}
      <div className="flex items-center justify-between">
        {dragHandleProps && (
          <button
            className="mr-1 cursor-grab touch-none text-muted hover:text-foreground transition-colors"
            aria-label="Drag to reorder"
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="5" cy="3" r="1.5" />
              <circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" />
              <circle cx="11" cy="13" r="1.5" />
            </svg>
          </button>
        )}
        <button
          className="mr-2 text-xs text-muted transition-transform duration-150"
          style={{ transform: minimised ? "rotate(0deg)" : "rotate(90deg)" }}
          onClick={() => setMinimised(!minimised)}
          aria-label={minimised ? "Expand course" : "Collapse course"}
        >
          ▶
        </button>
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="w-full rounded-lg border border-border bg-surface-1 px-2 py-1 text-base font-semibold text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              autoFocus
            />
          ) : (
            <h3
              className="cursor-pointer text-base font-semibold text-foreground truncate hover:text-accent transition-colors"
              onClick={startEditingTitle}
              title="Click to rename"
            >
              {course.title}
            </h3>
          )}
        </div>
        <Button
          variant="ghost"
          className="!px-1.5 !py-0.5 text-muted-foreground hover:text-red-500"
          onClick={handleXButton}
          aria-label={periodContext ? "Remove from period" : "Delete course"}
          title={periodContext ? "Remove from period" : "Delete course"}
        >
          &times;
        </Button>
      </div>

      {/* Course meta — always visible even when minimised */}
      {!hasParts && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Grade badge — click to edit */}
          {editingGrade ? (
            <div className="flex gap-0.5 flex-wrap">
              {gradeOptions.map((g) => (
                <button
                  key={g}
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold border transition-colors ${
                    course.grade === g
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-surface-1 text-muted hover:text-foreground"
                  }`}
                  onClick={() => handleGradeChange(g)}
                >
                  {g}
                </button>
              ))}
              <button
                className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:text-foreground"
                onClick={() => setEditingGrade(false)}
              >
                esc
              </button>
            </div>
          ) : (
            <button
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold cursor-pointer ${colorClass}`}
              onClick={() => setEditingGrade(true)}
              title="Click to change grade"
            >
              {course.grade}
            </button>
          )}

          {/* Credits — click to edit */}
          {editingCredits ? (
            <input
              ref={creditsInputRef}
              type="number"
              min="0.5"
              step="0.5"
              value={creditsDraft}
              onChange={(e) => setCreditsDraft(e.target.value)}
              onBlur={commitCredits}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitCredits(); }
                if (e.key === "Escape") setEditingCredits(false);
              }}
              className="w-16 rounded-md border border-border bg-surface-1 px-1.5 py-0.5 text-xs text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              autoFocus
            />
          ) : (
            <button
              className="text-xs text-muted hover:text-accent transition-colors cursor-pointer"
              onClick={startEditingCredits}
              title="Click to edit credits"
            >
              {course.credits} credit{course.credits !== 1 ? "s" : ""}
            </button>
          )}

          {/* Grading mode — click to toggle */}
          {editingMode ? (
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                  course.gradingMode === "letter"
                    ? "bg-accent text-white"
                    : "bg-surface-1 text-muted hover:text-foreground"
                }`}
                onClick={() => handleModeChange("letter")}
              >
                Letter
              </button>
              <button
                className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                  course.gradingMode === "pf"
                    ? "bg-accent text-white"
                    : "bg-surface-1 text-muted hover:text-foreground"
                }`}
                onClick={() => handleModeChange("pf")}
              >
                P/F
              </button>
              <button
                className="px-1.5 py-0.5 text-xs text-muted hover:text-foreground bg-surface-1"
                onClick={() => setEditingMode(false)}
              >
                esc
              </button>
            </div>
          ) : (
            <button
              className="text-xs text-muted hover:text-accent transition-colors cursor-pointer"
              onClick={() => setEditingMode(true)}
              title="Click to change grading mode"
            >
              {course.gradingMode === "pf" ? "Pass/Fail" : "Letter"}
            </button>
          )}

          {/* Move to period dropdown (whole course mode only) */}
          {allSemesters.length > 0 && (
            <select
              value={course.periodId ?? ""}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="rounded-md border border-border bg-surface-1 px-1.5 py-0.5 text-xs text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              title="Move to period"
            >
              <option value="">Unassigned</option>
              {renderPeriodOptions()}
              <option value="__split__">Split into parts...</option>
            </select>
          )}
        </div>
      )}

      {/* Parts section (when course is split) */}
      {hasParts && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-muted">Parts</p>
            <span className="text-xs text-muted">({course.credits} total credits)</span>
          </div>
          {course.parts!.map((part) => {
            const partGradeOptions = part.gradingMode === "letter" ? LETTER_GRADES : PF_GRADES;
            const partColorClass = GRADE_COLORS[part.grade] ?? "bg-gray-100 text-gray-700";
            return (
              <div key={part.id} className="flex items-center gap-1.5 flex-wrap rounded-lg border border-border bg-surface-2/50 px-2.5 py-1.5">
                {/* Part name */}
                <input
                  type="text"
                  value={part.name}
                  onChange={(e) => updatePart(part.id, { name: e.target.value })}
                  onBlur={(e) => {
                    const trimmed = e.target.value.trim();
                    if (!trimmed) updatePart(part.id, { name: "Unnamed" });
                  }}
                  className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-foreground hover:border-border focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  title="Part name"
                />

                {/* Part credits */}
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={part.credits}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    if (num > 0) updatePart(part.id, { credits: num });
                  }}
                  className="w-12 rounded border border-border bg-surface-1 px-1 py-0.5 text-xs text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  title="Credits"
                />
                <span className="text-[10px] text-muted">cr</span>

                {/* Part grading mode */}
                <select
                  value={part.gradingMode}
                  onChange={(e) => {
                    const mode = e.target.value as GradingMode;
                    const newGrade = mode === "letter" ? "A" : "P";
                    updatePart(part.id, { gradingMode: mode, grade: newGrade as CoursePart["grade"] });
                  }}
                  className="rounded border border-border bg-surface-1 px-1 py-0.5 text-[10px] text-muted focus:border-accent focus:outline-none"
                >
                  <option value="letter">Letter</option>
                  <option value="pf">P/F</option>
                </select>

                {/* Part grade */}
                <select
                  value={part.grade}
                  onChange={(e) => updatePart(part.id, { grade: e.target.value as CoursePart["grade"] })}
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold border-0 focus:outline-none focus:ring-1 focus:ring-accent/20 ${partColorClass}`}
                >
                  {partGradeOptions.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>

                {/* Part period */}
                {allSemesters.length > 0 && (
                  <select
                    value={part.periodId ?? ""}
                    onChange={(e) => updatePart(part.id, { periodId: e.target.value || undefined })}
                    className="rounded border border-border bg-surface-1 px-1 py-0.5 text-[10px] text-muted focus:border-accent focus:outline-none"
                    title="Assign to period"
                  >
                    <option value="">No period</option>
                    {renderPeriodOptions()}
                  </select>
                )}

                {/* Remove part */}
                <button
                  className="ml-auto text-xs text-muted hover:text-red-500 transition-colors"
                  onClick={() => removePart(part.id)}
                  title="Remove part"
                >
                  &times;
                </button>
              </div>
            );
          })}

          <div className="flex items-center gap-2">
            <button
              className="text-xs text-muted hover:text-accent transition-colors"
              onClick={addPart}
            >
              + Add Part
            </button>
            <span className="text-muted">·</span>
            <button
              className="text-xs text-muted hover:text-accent transition-colors"
              onClick={handleMergeToWhole}
            >
              Merge to whole course
            </button>
          </div>
        </div>
      )}

      {/* Collapsible body */}
      {!minimised && (
        <div className="flex flex-col gap-1 mt-1">
          {courseGoals.length > 0 && (
            <p className="text-xs font-medium text-muted">Assigned Goals</p>
          )}
          {courseGoals.map((goal) => {
            const progress = computeProgress(goal.tasks);
            const expanded = expandedGoalId === goal.id;
            const gGrade = goalGrades[goal.id];
            const gColorClass = gGrade ? (GRADE_COLORS[gGrade] ?? "bg-gray-100 text-gray-700") : null;
            const showGradePicker = gradingGoalId === goal.id;

            return (
              <div key={goal.id} className="rounded-lg border border-border bg-surface-2/50 px-3 py-2">
                <div className="flex w-full items-center gap-2">
                  <button
                    className="flex flex-1 items-center gap-2 text-left min-w-0"
                    onClick={() => setExpandedGoalId(expanded ? null : goal.id)}
                  >
                    <span className="text-xs text-muted transition-transform duration-150" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                      ▶
                    </span>
                    <span className="flex-1 text-sm text-foreground truncate">{goal.title}</span>
                  </button>

                  {showGradePicker ? (
                    <div className="flex gap-0.5 flex-wrap">
                      {ALL_GOAL_GRADES.map((g) => (
                        <button
                          key={g}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border transition-colors ${
                            gGrade === g
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border bg-surface-1 text-muted hover:text-foreground"
                          }`}
                          onClick={() => handleSetGoalGrade(goal.id, g)}
                        >
                          {g}
                        </button>
                      ))}
                      <button
                        className="rounded px-1.5 py-0.5 text-[10px] text-muted hover:text-foreground"
                        onClick={() => setGradingGoalId(null)}
                      >
                        esc
                      </button>
                    </div>
                  ) : gGrade && gColorClass ? (
                    <button
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${gColorClass}`}
                      onClick={() => setGradingGoalId(goal.id)}
                      title="Click to change grade"
                    >
                      {gGrade}
                    </button>
                  ) : (
                    <button
                      className="text-[10px] text-muted hover:text-accent transition-colors"
                      onClick={() => setGradingGoalId(goal.id)}
                      title="Set grade"
                    >
                      grade
                    </button>
                  )}

                  <button
                    className="text-xs text-muted hover:text-red-500 transition-colors"
                    onClick={() => handleRemoveGoal(goal.id)}
                    title="Remove goal from course"
                  >
                    &times;
                  </button>
                </div>
                <div className="mt-1 ml-4">
                  <ProgressBar value={progress} />
                </div>
                {expanded && goal.tasks.length > 0 && (
                  <div className="mt-2 ml-4 flex flex-col gap-1">
                    {goal.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-xs">
                        <span className={task.completed ? "text-emerald-500" : "text-muted"}>
                          {task.completed ? "✓" : "○"}
                        </span>
                        <span className={`truncate ${task.completed ? "text-muted line-through" : "text-foreground"}`}>
                          {task.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {showGoalPicker ? (
            <div className="rounded-lg border border-border bg-surface-2/50 p-2">
              {availableGoals.length === 0 ? (
                <p className="text-xs text-muted py-1 text-center">No available goals to add</p>
              ) : (
                <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                  {availableGoals.map((goal) => {
                    const progress = computeProgress(goal.tasks);
                    return (
                      <button
                        key={goal.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-surface-2 transition-colors"
                        onClick={() => handleAddGoal(goal.id)}
                      >
                        <span className="flex-1 truncate">{goal.title}</span>
                        <span className="text-xs text-muted tabular-nums">{Math.round(progress * 100)}%</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                className="mt-1 w-full text-xs text-muted hover:text-foreground transition-colors"
                onClick={() => setShowGoalPicker(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted hover:text-accent hover:border-accent transition-colors"
              onClick={() => setShowGoalPicker(true)}
            >
              + Add Goal
            </button>
          )}
        </div>
      )}
    </div>
  );
}
