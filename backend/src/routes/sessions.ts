import { Router } from "express";
import { createSupabaseClient } from "../supabase.js";

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function mapSession(s: Record<string, unknown>) {
  return {
    id: s.id,
    taskId: s.task_id,
    goalId: s.goal_id,
    date: s.date,
    startTime: s.start_time,
    endTime: s.end_time,
    ...(s.title ? { title: s.title } : {}),
    ...(s.notes ? { notes: s.notes } : {}),
    createdAt: s.created_at,
  };
}

// GET /sessions?month=YYYY-MM or ?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);
  const { month, date } = req.query;

  let query = supabase.from("sessions").select("*");

  if (typeof date === "string" && DATE_RE.test(date)) {
    query = query.eq("date", date);
  } else if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) {
    // Filter by month: date starts with YYYY-MM
    const startDate = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    query = query.gte("date", startDate).lt("date", nextMonth);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map(mapSession));
});

// POST /sessions
router.post("/", async (req, res) => {
  const { taskId, goalId, date, startTime, endTime, title, notes } = req.body;

  if (!goalId || typeof goalId !== "string") {
    res.status(400).json({ error: "goalId is required" }); return;
  }
  if (!taskId || typeof taskId !== "string") {
    res.status(400).json({ error: "taskId is required" }); return;
  }
  if (!date || typeof date !== "string" || !DATE_RE.test(date)) {
    res.status(400).json({ error: "date is required in YYYY-MM-DD format" }); return;
  }
  if (!startTime || typeof startTime !== "string" || !TIME_RE.test(startTime)) {
    res.status(400).json({ error: "startTime is required in HH:MM format" }); return;
  }
  if (!endTime || typeof endTime !== "string" || !TIME_RE.test(endTime)) {
    res.status(400).json({ error: "endTime is required in HH:MM format" }); return;
  }
  if (endTime <= startTime) {
    res.status(400).json({ error: "endTime must be after startTime" }); return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  const { data: s, error } = await supabase
    .from("sessions")
    .insert({
      user_id: req.userId,
      task_id: taskId,
      goal_id: goalId,
      date,
      start_time: startTime,
      end_time: endTime,
      title: title || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json(mapSession(s));
});

// PATCH /sessions/:id
router.patch("/:id", async (req, res) => {
  const { date, startTime, endTime, title, notes } = req.body;

  if (date !== undefined && (typeof date !== "string" || !DATE_RE.test(date))) {
    res.status(400).json({ error: "date must be in YYYY-MM-DD format" }); return;
  }
  if (startTime !== undefined && (typeof startTime !== "string" || !TIME_RE.test(startTime))) {
    res.status(400).json({ error: "startTime must be in HH:MM format" }); return;
  }
  if (endTime !== undefined && (typeof endTime !== "string" || !TIME_RE.test(endTime))) {
    res.status(400).json({ error: "endTime must be in HH:MM format" }); return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  // Get current session to validate time constraints
  const { data: current } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (!current) { res.status(404).json({ error: "Session not found" }); return; }

  const newStart = startTime ?? current.start_time;
  const newEnd = endTime ?? current.end_time;
  if (newEnd <= newStart) {
    res.status(400).json({ error: "endTime must be after startTime" }); return;
  }

  const updates: Record<string, unknown> = {};
  if (date !== undefined) updates.date = date;
  if (startTime !== undefined) updates.start_time = startTime;
  if (endTime !== undefined) updates.end_time = endTime;
  if (title !== undefined) updates.title = title;
  if (notes !== undefined) updates.notes = notes;

  const { data: s, error } = await supabase
    .from("sessions")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json(mapSession(s));
});

// DELETE /sessions/:id
router.delete("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);
  const { error } = await supabase.from("sessions").delete().eq("id", req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

export default router;
