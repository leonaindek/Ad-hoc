import { Router } from "express";
import { createSupabaseClient } from "../supabase.js";

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function mapStudyTimeGoal(g: Record<string, unknown>) {
  return {
    id: g.id,
    date: g.date,
    targetMinutes: g.target_minutes,
    createdAt: g.created_at,
  };
}

// GET /study-goals?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);
  const { date } = req.query;

  let query = supabase.from("study_time_goals").select("*");
  if (typeof date === "string" && DATE_RE.test(date)) {
    query = query.eq("date", date);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(mapStudyTimeGoal));
});

// POST /study-goals — upsert by date
router.post("/", async (req, res) => {
  const { date, targetMinutes } = req.body;

  if (!date || typeof date !== "string" || !DATE_RE.test(date)) {
    res.status(400).json({ error: "date is required in YYYY-MM-DD format" }); return;
  }
  if (typeof targetMinutes !== "number" || targetMinutes <= 0) {
    res.status(400).json({ error: "targetMinutes must be a positive number" }); return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  // Check if one already exists for this date
  const { data: existing } = await supabase
    .from("study_time_goals")
    .select("*")
    .eq("date", date)
    .single();

  if (existing) {
    const { data: updated, error } = await supabase
      .from("study_time_goals")
      .update({ target_minutes: targetMinutes })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(mapStudyTimeGoal(updated));
    return;
  }

  const { data: g, error } = await supabase
    .from("study_time_goals")
    .insert({
      user_id: req.userId,
      date,
      target_minutes: targetMinutes,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(mapStudyTimeGoal(g));
});

// PATCH /study-goals/:id
router.patch("/:id", async (req, res) => {
  const { targetMinutes } = req.body;

  if (targetMinutes !== undefined && (typeof targetMinutes !== "number" || targetMinutes <= 0)) {
    res.status(400).json({ error: "targetMinutes must be a positive number" }); return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  const updates: Record<string, unknown> = {};
  if (targetMinutes !== undefined) updates.target_minutes = targetMinutes;

  const { data: g, error } = await supabase
    .from("study_time_goals")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error || !g) { res.status(404).json({ error: "Study time goal not found" }); return; }
  res.json(mapStudyTimeGoal(g));
});

// DELETE /study-goals/:id
router.delete("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);
  const { error } = await supabase.from("study_time_goals").delete().eq("id", req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

export default router;
