"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Goal, Task, UpdateGoalPayload } from "@/types";
import GoalCard from "@/components/GoalCard";

type SortableGoalCardProps = {
  goal: Goal;
  onDeleteGoal: (goalId: string) => void;
  onUpdateGoal: (goalId: string, payload: UpdateGoalPayload) => void;
  onAddTask: (goalId: string, title: string, weight: number, dueDate?: string) => void;
  onToggleTask: (goalId: string, task: Task) => void;
  onUpdateTask: (goalId: string, taskId: string, title: string, weight: number, dueDate?: string) => void;
  onDeleteTask: (goalId: string, taskId: string) => void;
  onReorderTasks: (goalId: string, taskIds: string[]) => void;
};

export default function SortableGoalCard(props: SortableGoalCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <GoalCard
        {...props}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}
