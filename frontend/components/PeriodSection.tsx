"use client";

import { useState, useRef } from "react";
import type { Period, Course, Goal, UpdateCoursePayload } from "@/types";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import GPADisplay from "@/components/GPADisplay";
import SortableCourseCard from "@/components/SortableCourseCard";
import DroppableContainer from "@/components/DroppableContainer";
import Button from "@/components/ui/Button";

type PeriodSectionProps = {
  period: Period;
  courses: Course[];
  goals: Goal[];
  allCourses: Course[];
  allPeriods: Period[];
  allSemesters: { id: string; name: string; year: number; order: number }[];
  onUpdatePeriod: (id: string, payload: { name?: string }) => void;
  onDeletePeriod: (id: string) => void;
  onDeleteCourse: (id: string) => void;
  onUpdateCourse: (id: string, payload: UpdateCoursePayload) => void;
  onNewCourse: (periodId: string) => void;
  onReorderCourses?: (courseIds: string[]) => void;
  isDragActive?: boolean;
};

/** Returns courses that belong to this period — either via periodId or via parts */
function coursesForPeriod(allCourses: Course[], periodId: string): Course[] {
  return allCourses.filter((c) => {
    if (c.parts && c.parts.length > 0) {
      return c.parts.some((p) => p.periodId === periodId);
    }
    return c.periodId === periodId;
  });
}

export default function PeriodSection({
  period,
  courses: _courses,
  goals,
  allCourses,
  allPeriods,
  allSemesters,
  onUpdatePeriod,
  onDeletePeriod,
  onDeleteCourse,
  onUpdateCourse,
  onNewCourse,
  onReorderCourses,
  isDragActive,
}: PeriodSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(period.name);
  const nameRef = useRef<HTMLInputElement>(null);

  // Compute courses for this period (including split courses)
  const periodCourses = coursesForPeriod(allCourses, period.id);
  const sortedPeriodCourses = [...periodCourses].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  function startEditing() {
    setNameDraft(period.name);
    setEditingName(true);
    setTimeout(() => nameRef.current?.select(), 0);
  }

  function commitName() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== period.name) {
      onUpdatePeriod(period.id, { name: trimmed });
    }
    setEditingName(false);
  }

  return (
    <div className="ml-4 border-l-2 border-border/50 pl-4">
      {/* Period header */}
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
            className="rounded-md border border-border bg-surface-1 px-2 py-0.5 text-sm font-medium text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            autoFocus
          />
        ) : (
          <h4
            className="cursor-pointer text-sm font-medium text-foreground hover:text-accent transition-colors"
            onClick={startEditing}
            title="Click to rename"
          >
            {period.name}
          </h4>
        )}

        <GPADisplay courses={periodCourses} compact label="GPA" periodId={period.id} />

        <div className="flex-1" />

        <Button
          variant="ghost"
          className="!px-1.5 !py-0.5 text-xs text-muted hover:text-red-500"
          onClick={() => onDeletePeriod(period.id)}
          aria-label="Delete period"
        >
          &times;
        </Button>
        <Button
          variant="ghost"
          className="!px-2 !py-0.5 text-xs"
          onClick={() => onNewCourse(period.id)}
        >
          + New Course
        </Button>
      </div>

      {/* Course grid */}
      {!collapsed && (
        <DroppableContainer id={`period:${period.id}`}>
          <SortableContext items={sortedPeriodCourses.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-h-[60px]">
              {sortedPeriodCourses.length === 0 && isDragActive && (
                <div className="col-span-full flex items-center justify-center rounded-lg border-2 border-dashed border-border text-sm text-muted py-4">
                  Drop courses here
                </div>
              )}
              {sortedPeriodCourses.map((course) => (
                <SortableCourseCard
                  key={course.id}
                  course={course}
                  goals={goals}
                  allCourses={allCourses}
                  allPeriods={allPeriods}
                  allSemesters={allSemesters}
                  periodContext={period.id}
                  onDelete={onDeleteCourse}
                  onUpdate={onUpdateCourse}
                />
              ))}
            </div>
          </SortableContext>
        </DroppableContainer>
      )}
    </div>
  );
}
