import { Router } from "express";
import { createSupabaseClient } from "../supabase.js";

const router = Router();

const LETTER_GRADES = ["A", "B", "C", "D", "E", "F"];
const PF_GRADES = ["P", "F"];

function mapCourse(c: Record<string, unknown>) {
  return {
    id: c.id,
    title: c.title,
    gradingMode: c.grading_mode,
    grade: c.grade,
    credits: c.credits,
    goalIds: c.goal_ids ?? [],
    goalGrades: c.goal_grades ?? {},
    ...(c.period_id ? { periodId: c.period_id } : {}),
    ...(c.parts ? { parts: c.parts } : {}),
    order: c.order,
    createdAt: c.created_at,
  };
}

// GET /courses
router.get("/", async (_req, res) => {
  const supabase = createSupabaseClient(_req.accessToken);
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("order", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(mapCourse));
});

// PUT /courses/reorder
router.put("/reorder", async (req, res) => {
  const { courseIds } = req.body;
  if (!Array.isArray(courseIds)) {
    res.status(400).json({ error: "courseIds must be an array" }); return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  for (let i = 0; i < courseIds.length; i++) {
    const { error } = await supabase
      .from("courses")
      .update({ order: i })
      .eq("id", courseIds[i]);
    if (error) { res.status(500).json({ error: error.message }); return; }
  }

  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("order", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(mapCourse));
});

// GET /courses/:id
router.get("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);
  const { data: c, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error || !c) { res.status(404).json({ error: "Course not found" }); return; }
  res.json(mapCourse(c));
});

// POST /courses
router.post("/", async (req, res) => {
  const { title, gradingMode, grade, credits, goalIds, goalGrades, periodId, parts } = req.body;

  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title is required" }); return;
  }
  if (gradingMode !== "letter" && gradingMode !== "pf") {
    res.status(400).json({ error: "gradingMode must be 'letter' or 'pf'" }); return;
  }
  if (gradingMode === "letter" && !LETTER_GRADES.includes(grade)) {
    res.status(400).json({ error: `grade must be one of ${LETTER_GRADES.join(", ")} for letter grading` }); return;
  }
  if (gradingMode === "pf" && !PF_GRADES.includes(grade)) {
    res.status(400).json({ error: `grade must be one of ${PF_GRADES.join(", ")} for pass/fail grading` }); return;
  }
  if (typeof credits !== "number" || credits <= 0) {
    res.status(400).json({ error: "credits must be a positive number" }); return;
  }

  const supabase = createSupabaseClient(req.accessToken);

  // Get max order
  const { data: existing } = await supabase
    .from("courses")
    .select("order")
    .order("order", { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? (existing[0].order ?? 0) + 1 : 0;

  const { data: c, error } = await supabase
    .from("courses")
    .insert({
      user_id: req.userId,
      title: title.trim(),
      grading_mode: gradingMode,
      grade,
      credits,
      goal_ids: goalIds ?? [],
      goal_grades: (goalGrades && typeof goalGrades === "object") ? goalGrades : {},
      period_id: periodId || null,
      parts: Array.isArray(parts) && parts.length > 0 ? parts : null,
      order: nextOrder,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(mapCourse(c));
});

// PATCH /courses/:id
router.patch("/:id", async (req, res) => {
  const { title, gradingMode, grade, credits, goalIds, goalGrades, periodId, parts } = req.body;

  const supabase = createSupabaseClient(req.accessToken);

  // Fetch current to validate
  const { data: current } = await supabase
    .from("courses")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (!current) { res.status(404).json({ error: "Course not found" }); return; }

  const updates: Record<string, unknown> = {};

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "title must be a non-empty string" }); return;
    }
    updates.title = title.trim();
  }

  if (gradingMode !== undefined) {
    if (gradingMode !== "letter" && gradingMode !== "pf") {
      res.status(400).json({ error: "gradingMode must be 'letter' or 'pf'" }); return;
    }
    updates.grading_mode = gradingMode;
  }

  if (grade !== undefined) {
    const mode = gradingMode ?? current.grading_mode;
    if (mode === "letter" && !LETTER_GRADES.includes(grade)) {
      res.status(400).json({ error: `grade must be one of ${LETTER_GRADES.join(", ")} for letter grading` }); return;
    }
    if (mode === "pf" && !PF_GRADES.includes(grade)) {
      res.status(400).json({ error: `grade must be one of ${PF_GRADES.join(", ")} for pass/fail grading` }); return;
    }
    updates.grade = grade;
  }

  if (credits !== undefined) {
    if (typeof credits !== "number" || credits <= 0) {
      res.status(400).json({ error: "credits must be a positive number" }); return;
    }
    updates.credits = credits;
  }

  if (goalIds !== undefined) {
    if (!Array.isArray(goalIds)) {
      res.status(400).json({ error: "goalIds must be an array" }); return;
    }
    updates.goal_ids = goalIds;
  }

  if (goalGrades !== undefined) {
    if (typeof goalGrades !== "object" || goalGrades === null) {
      res.status(400).json({ error: "goalGrades must be an object" }); return;
    }
    updates.goal_grades = { ...(current.goal_grades ?? {}), ...goalGrades };
  }

  if (periodId !== undefined) {
    if (periodId === null || periodId === "") {
      updates.period_id = null;
    } else {
      updates.period_id = periodId;
    }
  }

  if (parts !== undefined) {
    if (parts === null || (Array.isArray(parts) && parts.length === 0)) {
      updates.parts = null;
    } else if (Array.isArray(parts)) {
      updates.parts = parts;
    }
  }

  const { data: c, error } = await supabase
    .from("courses")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(mapCourse(c));
});

// DELETE /courses/:id
router.delete("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req.accessToken);
  const { error } = await supabase.from("courses").delete().eq("id", req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

export default router;
