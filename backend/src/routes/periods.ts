import { Router } from "express";
import { createSupabaseClient } from "../supabase.js";

const router = Router();

function mapPeriod(p: Record<string, unknown>) {
  return {
    id: p.id,
    semesterId: p.semester_id,
    name: p.name,
    order: p.order,
    createdAt: p.created_at,
  };
}

// GET /periods — optional ?semesterId filter
router.get("/", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);
  const semesterId = req.query.semesterId as string | undefined;

  let query = supabase.from("periods").select("*").order("order", { ascending: true });
  if (semesterId) {
    query = query.eq("semester_id", semesterId);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(mapPeriod));
});

// POST /periods
router.post("/", async (req, res) => {
  const { semesterId, name } = req.body;

  if (!semesterId || typeof semesterId !== "string") {
    res.status(400).json({ error: "semesterId is required" }); return;
  }
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" }); return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  // Verify semester exists
  const { data: sem } = await supabase.from("semesters").select("id").eq("id", semesterId).single();
  if (!sem) { res.status(400).json({ error: "Semester not found" }); return; }

  const { data: existing } = await supabase
    .from("periods")
    .select("order")
    .eq("semester_id", semesterId)
    .order("order", { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? (existing[0].order ?? 0) + 1 : 1;

  const { data: p, error } = await supabase
    .from("periods")
    .insert({
      user_id: req.userId,
      semester_id: semesterId,
      name: name.trim(),
      order: nextOrder,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(mapPeriod(p));
});

// PATCH /periods/:id
router.patch("/:id", async (req, res) => {
  const { name, order } = req.body;

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    res.status(400).json({ error: "name must be a non-empty string" }); return;
  }
  if (order !== undefined && typeof order !== "number") {
    res.status(400).json({ error: "order must be a number" }); return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (order !== undefined) updates.order = order;

  const { data: p, error } = await supabase
    .from("periods")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error || !p) { res.status(404).json({ error: "Period not found" }); return; }
  res.json(mapPeriod(p));
});

// DELETE /periods/:id — unassign courses in that period
router.delete("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);

  // Unassign courses belonging to this period
  await supabase
    .from("courses")
    .update({ period_id: null })
    .eq("period_id", req.params.id);

  const { error } = await supabase.from("periods").delete().eq("id", req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

export default router;
