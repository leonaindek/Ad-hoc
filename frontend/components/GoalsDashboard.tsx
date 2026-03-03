"use client";

import { useState, useEffect, useCallback, useId } from "react";
import type { Goal, Task, UpdateGoalPayload } from "@/types";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { api } from "@/lib/api";
import SortableGoalCard from "@/components/SortableGoalCard";
import CreateGoalModal from "@/components/CreateGoalModal";
import Button from "@/components/ui/Button";
import DashboardCard from "@/components/DashboardCard";

function ShimmerCard() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-1 p-5">
      <div className="animate-shimmer h-5 w-3/4 rounded-lg" />
      <div className="animate-shimmer h-2 w-full rounded-full" />
      <div className="space-y-2">
        <div className="animate-shimmer h-4 w-full rounded-lg" />
        <div className="animate-shimmer h-4 w-5/6 rounded-lg" />
        <div className="animate-shimmer h-4 w-2/3 rounded-lg" />
      </div>
    </div>
  );
}

export default function GoalsDashboard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const sortedGoals = [...goals].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  const handleGoalDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedGoals.findIndex((g) => g.id === active.id);
      const newIndex = sortedGoals.findIndex((g) => g.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...sortedGoals];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      const goalIds = reordered.map((g) => g.id);

      // Optimistic update
      setGoals(reordered.map((g, i) => ({ ...g, order: i })));
      api.reorderGoals(goalIds).catch(async () => {
        setError("Failed to reorder goals");
        const fresh = await api.getGoals();
        setGoals(fresh);
      });
    },
    [sortedGoals]
  );

  useEffect(() => {
    api
      .getGoals()
      .then(setGoals)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleCreateGoal(title: string, dueDate?: string) {
    const goal = await api.createGoal({ title, dueDate });
    setGoals((prev) => [...prev, goal]);
    setShowCreateModal(false);
  }

  async function handleUpdateGoal(goalId: string, payload: UpdateGoalPayload) {
    try {
      const updated = await api.updateGoal(goalId, payload);
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, ...updated } : g))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update goal");
    }
  }

  async function handleDeleteGoal(goalId: string) {
    try {
      await api.deleteGoal(goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete goal");
    }
  }

  async function handleAddTask(goalId: string, title: string, weight: number) {
    try {
      const task = await api.createTask(goalId, { title, weight });
      setGoals((prev) =>
        prev.map((g) =>
          g.id !== goalId ? g : { ...g, tasks: [...g.tasks, task] }
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task");
    }
  }

  async function handleToggleTask(goalId: string, task: Task) {
    try {
      const updated = await api.updateTask(goalId, task.id, {
        completed: !task.completed,
      });
      setGoals((prev) =>
        prev.map((g) =>
          g.id !== goalId
            ? g
            : { ...g, tasks: g.tasks.map((t) => (t.id === task.id ? updated : t)) }
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  async function handleUpdateTask(
    goalId: string,
    taskId: string,
    title: string,
    weight: number,
    dueDate?: string
  ) {
    try {
      const updated = await api.updateTask(goalId, taskId, { title, weight, dueDate });
      setGoals((prev) =>
        prev.map((g) =>
          g.id !== goalId
            ? g
            : { ...g, tasks: g.tasks.map((t) => (t.id === taskId ? updated : t)) }
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  async function handleDeleteTask(goalId: string, taskId: string) {
    try {
      await api.deleteTask(goalId, taskId);
      setGoals((prev) =>
        prev.map((g) =>
          g.id !== goalId
            ? g
            : { ...g, tasks: g.tasks.filter((t) => t.id !== taskId) }
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  async function handleReorderTasks(goalId: string, taskIds: string[]) {
    // Optimistically update local state
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const taskMap = new Map(g.tasks.map((t) => [t.id, t]));
        return { ...g, tasks: taskIds.map((id) => taskMap.get(id)!) };
      })
    );
    try {
      await api.reorderTasks(goalId, taskIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder tasks");
      // Revert on failure by refetching
      const goals = await api.getGoals();
      setGoals(goals);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <DashboardCard goals={goals} onToggleTask={handleToggleTask} />

      <div className="mb-8 flex items-center justify-end">
        <Button onClick={() => setShowCreateModal(true)}>+ New Goal</Button>
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
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="mb-2 text-4xl">🎯</p>
          <p className="text-lg font-medium text-foreground">No goals yet</p>
          <p className="text-sm text-muted">Click &quot;+ New Goal&quot; to get started.</p>
        </div>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleGoalDragEnd}
        >
          <SortableContext items={sortedGoals.map((g) => g.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedGoals.map((goal) => (
                <SortableGoalCard
                  key={goal.id}
                  goal={goal}
                  onDeleteGoal={handleDeleteGoal}
                  onUpdateGoal={handleUpdateGoal}
                  onAddTask={handleAddTask}
                  onToggleTask={handleToggleTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onReorderTasks={handleReorderTasks}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <CreateGoalModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateGoal}
      />
    </div>
  );
}
