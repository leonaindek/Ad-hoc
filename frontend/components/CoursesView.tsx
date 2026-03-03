"use client";

import { useState, useEffect, useCallback, useRef, useId } from "react";
import type {
  Course,
  Goal,
  Semester,
  Period,
  CreateCoursePayload,
  UpdateCoursePayload,
  CreateSemesterPayload,
  CreatePeriodPayload,
} from "@/types";
import {
  DndContext,
  closestCenter,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { api } from "@/lib/api";
import GPADisplay from "@/components/GPADisplay";
import SortableCourseCard from "@/components/SortableCourseCard";
import CourseCard from "@/components/CourseCard";
import DroppableContainer from "@/components/DroppableContainer";
import CreateCourseModal from "@/components/CreateCourseModal";
import CreateSemesterModal from "@/components/CreateSemesterModal";
import CreatePeriodModal from "@/components/CreatePeriodModal";
import SemesterSection from "@/components/SemesterSection";
import Button from "@/components/ui/Button";

function ShimmerCard() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-1 p-5">
      <div className="animate-shimmer h-5 w-3/4 rounded-lg" />
      <div className="animate-shimmer h-3 w-1/3 rounded-lg" />
      <div className="animate-shimmer h-4 w-full rounded-lg" />
    </div>
  );
}

export default function CoursesView() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [createCoursePeriodId, setCreateCoursePeriodId] = useState<string | undefined>();
  const [showCreateSemester, setShowCreateSemester] = useState(false);
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [createPeriodSemesterId, setCreatePeriodSemesterId] = useState("");

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const startContainerRef = useRef<string | null>(null);
  const lastOverContainerRef = useRef<string | null>(null);
  const coursesBeforeDragRef = useRef<Course[]>([]);

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    Promise.all([api.getCourses(), api.getGoals(), api.getSemesters(), api.getPeriods()])
      .then(([coursesData, goalsData, semestersData, periodsData]) => {
        setCourses(coursesData);
        setGoals(goalsData);
        setSemesters(semestersData);
        setPeriods(periodsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  // --- Helpers ---

  function findContainer(id: string | number): string | null {
    const sid = String(id);
    if (sid === "unassigned" || sid.startsWith("period:")) return sid;
    // It's a course id — look up its container
    const course = courses.find((c) => c.id === sid);
    if (!course) return null;
    return course.periodId ? `period:${course.periodId}` : "unassigned";
  }

  function containerToPeriodId(container: string): string | undefined {
    if (container === "unassigned") return undefined;
    return container.replace("period:", "");
  }

  // Custom collision detection: try closestCenter first, fall back to rectIntersection
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const centerResult = closestCenter(args);
    if (centerResult.length > 0) return centerResult;
    return rectIntersection(args);
  }, []);

  // --- Handlers ---

  async function handleCreateCourse(payload: CreateCoursePayload) {
    try {
      const course = await api.createCourse(payload);
      setCourses((prev) => [...prev, course]);
      setShowCreateCourse(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    }
  }

  async function handleUpdateCourse(id: string, payload: UpdateCoursePayload) {
    try {
      const updated = await api.updateCourse(id, payload);
      setCourses((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update course");
    }
  }

  async function handleDeleteCourse(id: string) {
    try {
      await api.deleteCourse(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete course");
    }
  }

  async function handleCreateSemester(payload: CreateSemesterPayload) {
    try {
      const semester = await api.createSemester(payload);
      setSemesters((prev) => [...prev, semester]);
      setShowCreateSemester(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create semester");
    }
  }

  async function handleUpdateSemester(id: string, payload: { name?: string; year?: number }) {
    try {
      const updated = await api.updateSemester(id, payload);
      setSemesters((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update semester");
    }
  }

  async function handleDeleteSemester(id: string) {
    try {
      await api.deleteSemester(id);
      setSemesters((prev) => prev.filter((s) => s.id !== id));
      const removedPeriodIds = new Set(periods.filter((p) => p.semesterId === id).map((p) => p.id));
      setPeriods((prev) => prev.filter((p) => p.semesterId !== id));
      setCourses((prev) =>
        prev.map((c) => {
          if (c.parts && c.parts.length > 0) {
            const hasAffected = c.parts.some((p) => p.periodId && removedPeriodIds.has(p.periodId));
            if (hasAffected) {
              return {
                ...c,
                parts: c.parts.map((p) =>
                  p.periodId && removedPeriodIds.has(p.periodId)
                    ? { ...p, periodId: undefined }
                    : p
                ),
              };
            }
            return c;
          }
          return c.periodId && removedPeriodIds.has(c.periodId)
            ? { ...c, periodId: undefined }
            : c;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete semester");
    }
  }

  async function handleCreatePeriod(payload: CreatePeriodPayload) {
    try {
      const period = await api.createPeriod(payload);
      setPeriods((prev) => [...prev, period]);
      setShowCreatePeriod(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create period");
    }
  }

  async function handleUpdatePeriod(id: string, payload: { name?: string }) {
    try {
      const updated = await api.updatePeriod(id, payload);
      setPeriods((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update period");
    }
  }

  async function handleDeletePeriod(id: string) {
    try {
      await api.deletePeriod(id);
      setPeriods((prev) => prev.filter((p) => p.id !== id));
      setCourses((prev) =>
        prev.map((c) => {
          if (c.parts && c.parts.length > 0) {
            const hasAffected = c.parts.some((p) => p.periodId === id);
            if (hasAffected) {
              return {
                ...c,
                parts: c.parts.map((p) =>
                  p.periodId === id ? { ...p, periodId: undefined } : p
                ),
              };
            }
            return c;
          }
          return c.periodId === id ? { ...c, periodId: undefined } : c;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete period");
    }
  }

  const handleReorderCourses = useCallback(
    async (courseIds: string[]) => {
      setCourses((prev) => {
        return prev.map((c) => {
          const idx = courseIds.indexOf(c.id);
          if (idx !== -1) return { ...c, order: idx };
          return c;
        });
      });
      try {
        await api.reorderCourses(courseIds);
      } catch {
        setError("Failed to reorder courses");
        const fresh = await api.getCourses();
        setCourses(fresh);
      }
    },
    []
  );

  function openNewCourse(periodId?: string) {
    setCreateCoursePeriodId(periodId);
    setShowCreateCourse(true);
  }

  function openNewPeriod(semesterId: string) {
    setCreatePeriodSemesterId(semesterId);
    setShowCreatePeriod(true);
  }

  // --- DnD handlers ---

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveId(id);
    const container = findContainer(id);
    startContainerRef.current = container;
    lastOverContainerRef.current = container;
    coursesBeforeDragRef.current = courses;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    // Guard: skip split courses
    const activeCourse = courses.find((c) => c.id === String(active.id));
    if (!activeCourse || (activeCourse.parts && activeCourse.parts.length > 0)) return;

    // Avoid redundant updates
    if (lastOverContainerRef.current === overContainer) return;
    lastOverContainerRef.current = overContainer;

    // Optimistically move the course to the new container
    const newPeriodId = containerToPeriodId(overContainer);
    setCourses((prev) =>
      prev.map((c) =>
        c.id === String(active.id) ? { ...c, periodId: newPeriodId } : c
      )
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const draggedId = String(active.id);

    setActiveId(null);

    if (!over) {
      // Cancelled — revert
      setCourses(coursesBeforeDragRef.current);
      startContainerRef.current = null;
      lastOverContainerRef.current = null;
      return;
    }

    const startContainer = startContainerRef.current;
    const endContainer = findContainer(active.id);

    startContainerRef.current = null;
    lastOverContainerRef.current = null;

    if (!startContainer || !endContainer) return;

    if (startContainer !== endContainer) {
      // Cross-container move — persist to backend
      const newPeriodId = containerToPeriodId(endContainer);
      handleUpdateCourse(draggedId, { periodId: newPeriodId ?? null });
    } else {
      // Same container — check for reorder
      const overId = String(over.id);
      if (overId !== draggedId && !overId.startsWith("period:") && overId !== "unassigned") {
        // Reorder within container
        const containerPeriodId = containerToPeriodId(endContainer);
        const containerCourses = courses
          .filter((c) => {
            if (c.parts && c.parts.length > 0) return false;
            if (containerPeriodId) return c.periodId === containerPeriodId;
            return !c.periodId;
          })
          .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

        const oldIndex = containerCourses.findIndex((c) => c.id === draggedId);
        const newIndex = containerCourses.findIndex((c) => c.id === overId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = [...containerCourses];
          const [moved] = reordered.splice(oldIndex, 1);
          reordered.splice(newIndex, 0, moved);
          handleReorderCourses(reordered.map((c) => c.id));
        }
      }
    }
  }

  function handleDragCancel() {
    setActiveId(null);
    setCourses(coursesBeforeDragRef.current);
    startContainerRef.current = null;
    lastOverContainerRef.current = null;
  }

  // --- Derived data ---
  const sortedSemesters = [...semesters].sort((a, b) => a.order - b.order);
  const unassignedCourses = courses
    .filter((c) => {
      if (c.parts && c.parts.length > 0) {
        return c.parts.every((p) => !p.periodId);
      }
      return !c.periodId;
    })
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  const activeCourse = activeId ? courses.find((c) => c.id === activeId) : null;
  const isDragActive = activeId !== null;
  const showUnassigned = unassignedCourses.length > 0 || isDragActive;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Overall GPA + New Semester button */}
      {!isLoading && courses.length > 0 && (
        <div className="mb-6">
          <GPADisplay courses={courses} label="Overall GPA" />
        </div>
      )}

      <div className="mb-8 flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={() => setShowCreateSemester(true)}>
          + New Semester
        </Button>
        <Button onClick={() => openNewCourse()}>+ New Course</Button>
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 font-medium hover:text-red-900 dark:hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ShimmerCard />
          <ShimmerCard />
          <ShimmerCard />
        </div>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex flex-col gap-6">
            {/* Semester hierarchy */}
            {sortedSemesters.map((semester) => {
              const semesterPeriods = periods.filter((p) => p.semesterId === semester.id);
              return (
                <SemesterSection
                  key={semester.id}
                  semester={semester}
                  periods={semesterPeriods}
                  courses={courses}
                  goals={goals}
                  allCourses={courses}
                  allPeriods={periods}
                  allSemesters={semesters}
                  onUpdateSemester={handleUpdateSemester}
                  onDeleteSemester={handleDeleteSemester}
                  onUpdatePeriod={handleUpdatePeriod}
                  onDeletePeriod={handleDeletePeriod}
                  onDeleteCourse={handleDeleteCourse}
                  onUpdateCourse={handleUpdateCourse}
                  onNewCourse={openNewCourse}
                  onNewPeriod={openNewPeriod}
                  onReorderCourses={handleReorderCourses}
                  isDragActive={isDragActive}
                />
              );
            })}

            {/* Unassigned courses */}
            {showUnassigned && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-sm font-medium text-muted">Unassigned Courses</span>
                  <div className="h-px flex-1 bg-border" />
                  <Button
                    variant="ghost"
                    className="!px-2 !py-0.5 text-xs"
                    onClick={() => openNewCourse()}
                  >
                    + New Course
                  </Button>
                </div>
                <DroppableContainer id="unassigned">
                  <SortableContext items={unassignedCourses.map((c) => c.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 min-h-[60px]">
                      {unassignedCourses.length === 0 && isDragActive && (
                        <div className="col-span-full flex items-center justify-center rounded-lg border-2 border-dashed border-border text-sm text-muted py-4">
                          Drop courses here
                        </div>
                      )}
                      {unassignedCourses.map((course) => (
                        <SortableCourseCard
                          key={course.id}
                          course={course}
                          goals={goals}
                          allCourses={courses}
                          allPeriods={periods}
                          allSemesters={semesters}
                          onDelete={handleDeleteCourse}
                          onUpdate={handleUpdateCourse}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DroppableContainer>
              </div>
            )}

            {/* Empty state */}
            {courses.length === 0 && semesters.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="mb-2 text-4xl">📚</p>
                <p className="text-lg font-medium text-foreground">No courses yet</p>
                <p className="text-sm text-muted">
                  Create a semester to organize your courses, or add a course directly.
                </p>
              </div>
            )}
          </div>

          {/* Drag overlay — floating card preview */}
          <DragOverlay>
            {activeCourse ? (
              <div className="rotate-2 scale-105">
                <CourseCard
                  course={activeCourse}
                  goals={goals}
                  allCourses={courses}
                  allPeriods={periods}
                  allSemesters={semesters}
                  onDelete={() => {}}
                  onUpdate={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modals */}
      <CreateCourseModal
        open={showCreateCourse}
        onClose={() => setShowCreateCourse(false)}
        onCreate={handleCreateCourse}
        goals={goals}
        existingCourses={courses}
        semesters={semesters}
        periods={periods}
        defaultPeriodId={createCoursePeriodId}
      />

      <CreateSemesterModal
        open={showCreateSemester}
        onClose={() => setShowCreateSemester(false)}
        onCreate={handleCreateSemester}
      />

      <CreatePeriodModal
        open={showCreatePeriod}
        onClose={() => setShowCreatePeriod(false)}
        onCreate={handleCreatePeriod}
        semesterId={createPeriodSemesterId}
      />
    </div>
  );
}
