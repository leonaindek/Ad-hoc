import { Router } from "express";
import { createSupabaseClient } from "../supabase.js";
import taskRouter from "./tasks.js";

const router = Router();

// GET /goals
router.get("/", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("order", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Fetch tasks for each goal and nest them
  const { data: tasks, error: tasksErr } = await supabase
    .from("tasks")
    .select("*, substeps(*), documents(*)")
    .order("order", { ascending: true });

  if (tasksErr) { res.status(500).json({ error: tasksErr.message }); return; }

  const goals = data.map((g: Record<string, unknown>) => ({
    id: g.id,
    title: g.title,
    ...(g.due_date ? { dueDate: g.due_date } : {}),
    order: g.order,
    createdAt: g.created_at,
    tasks: (tasks ?? [])
      .filter((t: Record<string, unknown>) => t.goal_id === g.id)
      .map(mapTask),
  }));

  res.json(goals);
});

// GET /goals/:id
router.get("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);
  const { data: g, error } = await supabase
    .from("goals")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error || !g) { res.status(404).json({ error: "Goal not found" }); return; }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, substeps(*), documents(*)")
    .eq("goal_id", g.id)
    .order("order", { ascending: true });

  res.json({
    id: g.id,
    title: g.title,
    ...(g.due_date ? { dueDate: g.due_date } : {}),
    order: g.order,
    createdAt: g.created_at,
    tasks: (tasks ?? []).map(mapTask),
  });
});

// PUT /goals/reorder
router.put("/reorder", async (req, res) => {
  const { goalIds } = req.body;
  if (!Array.isArray(goalIds)) {
    res.status(400).json({ error: "goalIds must be an array" });
    return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  for (let i = 0; i < goalIds.length; i++) {
    const { error } = await supabase
      .from("goals")
      .update({ order: i })
      .eq("id", goalIds[i]);
    if (error) { res.status(500).json({ error: error.message }); return; }
  }

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("order", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, substeps(*), documents(*)")
    .order("order", { ascending: true });

  const goals = (data ?? []).map((g: Record<string, unknown>) => ({
    id: g.id,
    title: g.title,
    ...(g.due_date ? { dueDate: g.due_date } : {}),
    order: g.order,
    createdAt: g.created_at,
    tasks: (tasks ?? [])
      .filter((t: Record<string, unknown>) => t.goal_id === g.id)
      .map(mapTask),
  }));

  res.json(goals);
});

// POST /goals
router.post("/", async (req, res) => {
  const { title, dueDate } = req.body;
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({ error: "title is required and must be a non-empty string" });
    return;
  }
  if (dueDate !== undefined && dueDate !== null) {
    if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      res.status(400).json({ error: "dueDate must be in YYYY-MM-DD format" });
      return;
    }
  }

  const supabase = createSupabaseClient(req.accessToken);

  // Get max order
  const { data: existing } = await supabase
    .from("goals")
    .select("order")
    .order("order", { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? (existing[0].order ?? 0) + 1 : 0;

  const { data: g, error } = await supabase
    .from("goals")
    .insert({
      user_id: req.userId,
      title: title.trim(),
      due_date: dueDate || null,
      order: nextOrder,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json({
    id: g.id,
    title: g.title,
    ...(g.due_date ? { dueDate: g.due_date } : {}),
    tasks: [],
    order: g.order,
    createdAt: g.created_at,
  });
});

// PATCH /goals/:id
router.patch("/:id", async (req, res) => {
  const { title, dueDate } = req.body;

  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    res.status(400).json({ error: "title must be a non-empty string" });
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
  if (dueDate === null) updates.due_date = null;
  else if (dueDate !== undefined) updates.due_date = dueDate;

  const { data: g, error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error || !g) { res.status(404).json({ error: "Goal not found" }); return; }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, substeps(*), documents(*)")
    .eq("goal_id", g.id)
    .order("order", { ascending: true });

  res.json({
    id: g.id,
    title: g.title,
    ...(g.due_date ? { dueDate: g.due_date } : {}),
    order: g.order,
    createdAt: g.created_at,
    tasks: (tasks ?? []).map(mapTask),
  });
});

// DELETE /goals/:id
router.delete("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", req.params.id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

// Nest task routes under /goals/:goalId/tasks
router.use("/:goalId/tasks", taskRouter);

// Helper to map DB task row to API shape
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
