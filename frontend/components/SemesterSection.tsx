"use client";

import { useState, useRef } from "react";
import type { Semester, Period, Course, Goal, UpdateCoursePayload } from "@/types";
import GPADisplay from "@/components/GPADisplay";
import PeriodSection from "@/components/PeriodSection";
import Button from "@/components/ui/Button";

type SemesterSectionProps = {
  semester: Semester;
  periods: Period[];
  courses: Course[];
  goals: Goal[];
  allCourses: Course[];
  allPeriods: Period[];
  allSemesters: Semester[];
  onUpdateSemester: (id: string, payload: { name?: string; year?: number }) => void;
  onDeleteSemester: (id: string) => void;
  onUpdatePeriod: (id: string, payload: { name?: string }) => void;
  onDeletePeriod: (id: string) => void;
  onDeleteCourse: (id: string) => void;
  onUpdateCourse: (id: string, payload: UpdateCoursePayload) => void;
  onNewCourse: (periodId: string) => void;
  onNewPeriod: (semesterId: string) => void;
  onReorderCourses?: (courseIds: string[]) => void;
  isDragActive?: boolean;
};

export default function SemesterSection({
  semester,
  periods,
  courses,
  goals,
  allCourses,
  allPeriods,
  allSemesters,
  onUpdateSemester,
  onDeleteSemester,
  onUpdatePeriod,
  onDeletePeriod,
  onDeleteCourse,
  onUpdateCourse,
  onNewCourse,
  onNewPeriod,
  onReorderCourses,
  isDragActive,
}: SemesterSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(semester.name);
  const [editingYear, setEditingYear] = useState(false);
  const [yearDraft, setYearDraft] = useState(String(semester.year));
  const nameRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // All courses in any period of this semester (including split courses)
  const periodIds = new Set(periods.map((p) => p.id));
  const semesterCourses = courses.filter((c) => {
    if (c.parts && c.parts.length > 0) {
      return c.parts.some((p) => p.periodId && periodIds.has(p.periodId));
    }
    return c.periodId && periodIds.has(c.periodId);
  });

  function startEditingName() {
    setNameDraft(semester.name);
    setEditingName(true);
    setTimeout(() => nameRef.current?.select(), 0);
  }

  function commitName() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== semester.name) {
      onUpdateSemester(semester.id, { name: trimmed });
    }
    setEditingName(false);
  }

  function startEditingYear() {
    setYearDraft(String(semester.year));
    setEditingYear(true);
    setTimeout(() => yearRef.current?.select(), 0);
  }

  function commitYear() {
    const num = Number(yearDraft);
    if (num > 0 && num !== semester.year) {
      onUpdateSemester(semester.id, { year: num });
    }
    setEditingYear(false);
  }

  const sortedPeriods = [...periods].sort((a, b) => a.order - b.order);

  return (
    <div className="rounded-xl border border-border bg-surface-1/50 p-4">
      {/* Semester header */}
      <div className="flex items-center gap-2 mb-3">
        <button
          className="text-xs text-muted transition-transform duration-150"
          style={{ transform: collapsed ? "rotate(0deg)" : "rotate(90deg)" }}
          onClick={() => setCollapsed(!collapsed)}
        >
          ▶
        </button>

        {editingName ? (
          <input
            ref={nameRef}
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitName(); }
              if (e.key === "Escape") setEditingName(false);
            }}
            className="rounded-md border border-border bg-surface-1 px-2 py-0.5 text-base font-semibold text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            autoFocus
          />
        ) : (
          <h3
            className="cursor-pointer text-base font-semibold text-foreground hover:text-accent transition-colors"
            onClick={startEditingName}
            title="Click to rename"
          >
            {semester.name}
          </h3>
        )}

        <span className="text-muted">—</span>

        {editingYear ? (
          <input
            ref={yearRef}
            type="number"
            min="1"
            value={yearDraft}
            onChange={(e) => setYearDraft(e.target.value)}
            onBlur={commitYear}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitYear(); }
              if (e.key === "Escape") setEditingYear(false);
            }}
            className="w-16 rounded-md border border-border bg-surface-1 px-2 py-0.5 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            autoFocus
          />
        ) : (
          <span
            className="cursor-pointer text-sm text-muted hover:text-accent transition-colors"
            onClick={startEditingYear}
            title="Click to edit year"
          >
            Year {semester.year}
          </span>
        )}

        <GPADisplay courses={semesterCourses} compact label="GPA" />

        <div className="flex-1" />

        <Button
          variant="ghost"
          className="!px-1.5 !py-0.5 text-muted hover:text-red-500"
          onClick={() => onDeleteSemester(semester.id)}
          aria-label="Delete semester"
        >
          &times;
        </Button>
      </div>

      {/* Periods */}
      {!collapsed && (
        <div className="flex flex-col gap-4">
          {sortedPeriods.map((period) => {
            const periodCourses = courses.filter((c) => c.periodId === period.id);
            return (
              <PeriodSection
                key={period.id}
                period={period}
                courses={periodCourses}
                goals={goals}
                allCourses={allCourses}
                allPeriods={allPeriods}
                allSemesters={allSemesters}
                onUpdatePeriod={onUpdatePeriod}
                onDeletePeriod={onDeletePeriod}
                onDeleteCourse={onDeleteCourse}
                onUpdateCourse={onUpdateCourse}
                onNewCourse={onNewCourse}
                onReorderCourses={onReorderCourses}
                isDragActive={isDragActive}
              />
            );
          })}
          <button
            className="ml-4 flex items-center gap-1 self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted hover:text-accent hover:border-accent transition-colors"
            onClick={() => onNewPeriod(semester.id)}
          >
            + New Period
          </button>
        </div>
      )}
    </div>
  );
}
