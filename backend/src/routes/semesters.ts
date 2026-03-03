import { Router } from "express";
import { createSupabaseClient } from "../supabase.js";

const router = Router();

function mapSemester(s: Record<string, unknown>) {
  return {
    id: s.id,
    name: s.name,
    year: s.year,
    order: s.order,
    createdAt: s.created_at,
  };
}

// GET /semesters
router.get("/", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);
  const { data, error } = await supabase
    .from("semesters")
    .select("*")
    .order("order", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(mapSemester));
});

// POST /semesters
router.post("/", async (req, res) => {
  const { name, year } = req.body;

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" }); return;
  }
  if (typeof year !== "number" || year <= 0) {
    res.status(400).json({ error: "year must be a positive number" }); return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  const { data: existing } = await supabase
    .from("semesters")
    .select("order")
    .order("order", { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? (existing[0].order ?? 0) + 1 : 1;

  const { data: s, error } = await supabase
    .from("semesters")
    .insert({
      user_id: req.userId,
      name: name.trim(),
      year,
      order: nextOrder,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(mapSemester(s));
});

// PATCH /semesters/:id
router.patch("/:id", async (req, res) => {
  const { name, year, order } = req.body;

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    res.status(400).json({ error: "name must be a non-empty string" }); return;
  }
  if (year !== undefined && (typeof year !== "number" || year <= 0)) {
    res.status(400).json({ error: "year must be a positive number" }); return;
  }
  if (order !== undefined && typeof order !== "number") {
    res.status(400).json({ error: "order must be a number" }); return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (year !== undefined) updates.year = year;
  if (order !== undefined) updates.order = order;

  const { data: s, error } = await supabase
    .from("semesters")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error || !s) { res.status(404).json({ error: "Semester not found" }); return; }
  res.json(mapSemester(s));
});

// DELETE /semesters/:id — cascade handled by DB foreign keys (on delete cascade for periods)
// But we also need to unassign courses from deleted periods
router.delete("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);

  // Find periods belonging to this semester
  const { data: periods } = await supabase
    .from("periods")
    .select("id")
    .eq("semester_id", req.params.id);

  const periodIds = (periods ?? []).map((p: { id: string }) => p.id);

  // Unassign courses from these periods
  if (periodIds.length > 0) {
    await supabase
      .from("courses")
      .update({ period_id: null })
      .in("period_id", periodIds);
  }

  // Delete semester (periods cascade)
  const { error } = await supabase.from("semesters").delete().eq("id", req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

export default router;
