"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Course, Goal, Period, UpdateCoursePayload } from "@/types";
import CourseCard from "@/components/CourseCard";

type SortableCourseCardProps = {
  course: Course;
  goals: Goal[];
  allCourses: Course[];
  allPeriods?: Period[];
  allSemesters?: { id: string; name: string; year: number; order: number }[];
  periodContext?: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, payload: UpdateCoursePayload) => void;
};

export default function SortableCourseCard(props: SortableCourseCardProps) {
  const hasParts = props.course.parts && props.course.parts.length > 0;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.course.id, disabled: hasParts });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CourseCard
        {...props}
        dragHandleProps={hasParts ? undefined : { attributes, listeners }}
      />
    </div>
  );
}
