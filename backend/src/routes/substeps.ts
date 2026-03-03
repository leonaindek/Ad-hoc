import { Router, Request } from "express";
import { createSupabaseClient } from "../supabase.js";

type SubstepParams = { goalId: string; taskId: string; substepId: string };

const router = Router({ mergeParams: true });

// POST /goals/:goalId/tasks/:taskId/substeps
router.post("/", async (req: Request<{ goalId: string; taskId: string }>, res) => {
  const { taskId } = req.params;
  const { title } = req.body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({ error: "title is required and must be a non-empty string" });
    return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  // Verify task exists
  const { data: task } = await supabase.from("tasks").select("id").eq("id", taskId).single();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const { data: s, error } = await supabase
    .from("substeps")
    .insert({
      user_id: req.userId,
      task_id: taskId,
      title: title.trim(),
      completed: false,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json({
    id: s.id,
    taskId: s.task_id,
    title: s.title,
    completed: s.completed,
    createdAt: s.created_at,
  });
});

// PATCH /goals/:goalId/tasks/:taskId/substeps/:substepId
router.patch("/:substepId", async (req: Request<SubstepParams>, res) => {
  const { substepId } = req.params;
  const { title, completed } = req.body;

  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    res.status(400).json({ error: "title must be a non-empty string" });
    return;
  }
  if (completed !== undefined && typeof completed !== "boolean") {
    res.status(400).json({ error: "completed must be a boolean" });
    return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title.trim();
  if (completed !== undefined) updates.completed = completed;

  const { data: s, error } = await supabase
    .from("substeps")
    .update(updates)
    .eq("id", substepId)
    .select()
    .single();

  if (error || !s) { res.status(404).json({ error: "Substep not found" }); return; }

  res.json({
    id: s.id,
    taskId: s.task_id,
    title: s.title,
    completed: s.completed,
    createdAt: s.created_at,
  });
});

// DELETE /goals/:goalId/tasks/:taskId/substeps/:substepId
router.delete("/:substepId", async (req: Request<SubstepParams>, res) => {
  const { substepId } = req.params;
  const supabase = createSupabaseClient(req.accessToken);
  const { error } = await supabase.from("substeps").delete().eq("id", substepId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

export default router;
