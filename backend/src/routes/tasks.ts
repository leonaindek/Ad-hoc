import { Router, Request } from "express";
import { createSupabaseClient } from "../supabase.js";
import substepRouter from "./substeps.js";
import documentRouter from "./documents.js";

type GoalParams = { goalId: string };
type TaskParams = { goalId: string; taskId: string };

const router = Router({ mergeParams: true });

// PUT /goals/:goalId/tasks/reorder
router.put("/reorder", async (req: Request<GoalParams>, res) => {
  const { goalId } = req.params;
  const { taskIds } = req.body;

  if (!Array.isArray(taskIds) || taskIds.some((id: unknown) => typeof id !== "string")) {
    res.status(400).json({ error: "taskIds must be an array of strings" });
    return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  // Verify all tasks belong to this goal
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("goal_id", goalId);

  const existingIds = new Set((existing ?? []).map((t: { id: string }) => t.id));
  const incomingIds = new Set(taskIds as string[]);
  if (existingIds.size !== incomingIds.size || ![...existingIds].every((id) => incomingIds.has(id))) {
    res.status(400).json({ error: "taskIds must contain exactly all task IDs for this goal" });
    return;
  }

  for (let i = 0; i < taskIds.length; i++) {
    await supabase.from("tasks").update({ order: i }).eq("id", taskIds[i]);
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, substeps(*), documents(*)")
    .eq("goal_id", goalId)
    .order("order", { ascending: true });

  res.json((tasks ?? []).map(mapTask));
});

// Nest substep and document routes
router.use("/:taskId/substeps", substepRouter);
router.use("/:taskId/documents", documentRouter);

// POST /goals/:goalId/tasks
router.post("/", async (req: Request<GoalParams>, res) => {
  const { goalId } = req.params;
  const { title, weight, dueDate } = req.body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({ error: "title is required and must be a non-empty string" });
    return;
  }
  if (typeof weight !== "number" || weight <= 0) {
    res.status(400).json({ error: "weight is required and must be a positive number" });
    return;
  }
  if (dueDate !== undefined && dueDate !== null) {
    if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      res.status(400).json({ error: "dueDate must be in YYYY-MM-DD format" });
      return;
    }
  }

  const supabase = createSupabaseClient(req.accessToken);

  // Verify goal exists
  const { data: goal } = await supabase.from("goals").select("id").eq("id", goalId).single();
  if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }

  // Get max order
  const { data: existing } = await supabase
    .from("tasks")
    .select("order")
    .eq("goal_id", goalId)
    .order("order", { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? (existing[0].order ?? 0) + 1 : 0;

  const { data: t, error } = await supabase
    .from("tasks")
    .insert({
      user_id: req.userId,
      goal_id: goalId,
      title: title.trim(),
      weight,
      completed: false,
      due_date: dueDate || null,
      order: nextOrder,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json({
    id: t.id,
    goalId: t.goal_id,
    title: t.title,
    weight: t.weight,
    completed: t.completed,
    ...(t.due_date ? { dueDate: t.due_date } : {}),
    createdAt: t.created_at,
  });
});

// PATCH /goals/:goalId/tasks/:taskId
router.patch("/:taskId", async (req: Request<TaskParams>, res) => {
  const { taskId } = req.params;
  const { title, weight, completed, dueDate } = req.body;

  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    res.status(400).json({ error: "title must be a non-empty string" });
    return;
  }
  if (weight !== undefined && (typeof weight !== "number" || weight <= 0)) {
    res.status(400).json({ error: "weight must be a positive number" });
    return;
  }
  if (completed !== undefined && typeof completed !== "boolean") {
    res.status(400).json({ error: "completed must be a boolean" });
    return;
  }
  if (dueDate !== undefined && dueDate !== null) {
    if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      res.status(400).json({ error: "dueDate must be in YYYY-MM-DD format" });
      return;
    }
  }

  const supabase = createSupabaseClient(req.accessToken);

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title.trim();
  if (weight !== undefined) updates.weight = weight;
  if (completed !== undefined) updates.completed = completed;
  if (dueDate === null) updates.due_date = null;
  else if (dueDate !== undefined) updates.due_date = dueDate;

  const { data: t, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .select()
    .single();

  if (error || !t) { res.status(404).json({ error: "Task not found" }); return; }

  res.json({
    id: t.id,
    goalId: t.goal_id,
    title: t.title,
    weight: t.weight,
    completed: t.completed,
    ...(t.due_date ? { dueDate: t.due_date } : {}),
    createdAt: t.created_at,
  });
});

// DELETE /goals/:goalId/tasks/:taskId
router.delete("/:taskId", async (req: Request<TaskParams>, res) => {
  const { taskId } = req.params;
  const supabase = createSupabaseClient(req.accessToken);
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

function mapTask(t: Record<string, unknown>) {
  return {
    id: t.id,
    goalId: t.goal_id,
    title: t.title,
    weight: t.weight,
    completed: t.completed,
    ...(t.due_date ? { dueDate: t.due_date } : {}),
    createdAt: t.created_at,
    substeps: ((t.substeps as Record<string, unknown>[] | null) ?? []).map((s) => ({
      id: s.id,
      taskId: s.task_id,
      title: s.title,
      completed: s.completed,
      createdAt: s.created_at,
    })),
    documents: ((t.documents as Record<string, unknown>[] | null) ?? []).map((d) => ({
      id: d.id,
      taskId: d.task_id,
      filename: d.filename,
      storedFilename: d.stored_filename,
      mimetype: d.mimetype,
      size: d.size,
      uploadedAt: d.uploaded_at,
    })),
  };
}

export default router;
