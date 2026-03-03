"use client";

import { useCallback, useMemo, useState, useRef } from "react";
import type { Goal, Task, UpdateGoalPayload } from "@/types";
import { DndContext, closestCenter, type DragEndEvent, type DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { computeProgress } from "@/lib/progress";
import { formatDate, isOverdue } from "@/lib/dates";
import ProgressBar from "@/components/ProgressBar";
import TaskItem from "@/components/TaskItem";
import AddTaskForm from "@/components/AddTaskForm";
import Button from "@/components/ui/Button";

type DragHandleProps = {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
};

type GoalCardProps = {
  goal: Goal;
  onDeleteGoal: (goalId: string) => void;
  onUpdateGoal: (goalId: string, payload: UpdateGoalPayload) => void;
  onAddTask: (goalId: string, title: string, weight: number, dueDate?: string) => void;
  onToggleTask: (goalId: string, task: Task) => void;
  onUpdateTask: (goalId: string, taskId: string, title: string, weight: number, dueDate?: string) => void;
  onDeleteTask: (goalId: string, taskId: string) => void;
  onReorderTasks: (goalId: string, taskIds: string[]) => void;
  dragHandleProps?: DragHandleProps;
};

export default function GoalCard({
  goal,
  onDeleteGoal,
  onUpdateGoal,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  onReorderTasks,
  dragHandleProps,
}: GoalCardProps) {
  const progress = computeProgress(goal.tasks);
  const overdue = goal.dueDate && isOverdue(goal.dueDate);

  const [minimised, setMinimised] = useState(false);

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(goal.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  function startEditingTitle() {
    setTitleDraft(goal.title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 0);
  }

  // Uncompleted tasks first, completed tasks at the bottom, preserving relative order
  const sortedTasks = useMemo(
    () => [...goal.tasks].sort((a, b) => Number(a.completed) - Number(b.completed)),
    [goal.tasks]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedTasks.findIndex((t) => t.id === active.id);
      const newIndex = sortedTasks.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...sortedTasks];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      onReorderTasks(goal.id, reordered.map((t) => t.id));
    },
    [goal.id, sortedTasks, onReorderTasks]
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
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
          aria-label={minimised ? "Expand goal" : "Collapse goal"}
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
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const trimmed = titleDraft.trim();
                  if (trimmed && trimmed !== goal.title) {
                    onUpdateGoal(goal.id, { title: trimmed });
                  }
                  setEditingTitle(false);
                }
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
              {goal.title}
            </h3>
          )}
          {goal.dueDate && (
            <p className={`text-xs mt-0.5 ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              Due {formatDate(goal.dueDate, true)}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          className="!px-1.5 !py-0.5 text-muted-foreground hover:text-red-500"
          onClick={() => onDeleteGoal(goal.id)}
          aria-label="Delete goal"
        >
          &times;
        </Button>
      </div>

      <ProgressBar value={progress} />

      {!minimised && (
        <>
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1">
                {sortedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={(t) => onToggleTask(goal.id, t)}
                    onUpdate={(taskId, title, weight, dueDate) => onUpdateTask(goal.id, taskId, title, weight, dueDate)}
                    onDelete={(taskId) => onDeleteTask(goal.id, taskId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <AddTaskForm onAdd={(title, weight, dueDate) => onAddTask(goal.id, title, weight, dueDate)} />
        </>
      )}
    </div>
  );
}
