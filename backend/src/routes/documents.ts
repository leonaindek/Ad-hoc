import { Router, Request } from "express";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import path from "node:path";
import { createSupabaseClient } from "../supabase.js";

type DocParams = { goalId: string; taskId: string; docId: string };

const ALLOWED_MIMES = ["application/pdf", "image/png", "image/jpeg"];

// Use memory storage — file buffer goes straight to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, PNG, and JPEG files are allowed"));
    }
  },
});

const router = Router({ mergeParams: true });

// POST /goals/:goalId/tasks/:taskId/documents
router.post(
  "/",
  upload.single("file"),
  async (req: Request<{ goalId: string; taskId: string }>, res) => {
    const { taskId } = req.params;

    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }

    const supabase = createSupabaseClient(req.accessToken);

    // Verify task exists
    const { data: task } = await supabase.from("tasks").select("id").eq("id", taskId).single();
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    // Upload to Supabase Storage: userId/uuid.ext
    const ext = path.extname(req.file.originalname);
    const storedFilename = `${uuidv4()}${ext}`;
    const storagePath = `${req.userId}/${storedFilename}`;

    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      res.status(500).json({ error: uploadError.message });
      return;
    }

    // Store metadata in DB (stored_filename holds the full storage path)
    const { data: d, error } = await supabase
      .from("documents")
      .insert({
        user_id: req.userId,
        task_id: taskId,
        filename: req.file.originalname,
        stored_filename: storagePath,
        mimetype: req.file.mimetype,
        size: req.file.size,
      })
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }

    res.status(201).json({
      id: d.id,
      taskId: d.task_id,
      filename: d.filename,
      storedFilename: d.stored_filename,
      mimetype: d.mimetype,
      size: d.size,
      uploadedAt: d.uploaded_at,
    });
  }
);

// GET /documents/:docId/file — return a signed URL
router.get("/:docId/file", async (req: Request<{ docId: string }>, res) => {
  const supabase = createSupabaseClient(req.accessToken);

  const { data: d } = await supabase
    .from("documents")
    .select("stored_filename")
    .eq("id", req.params.docId)
    .single();

  if (!d) { res.status(404).json({ error: "Document not found" }); return; }

  const { data: signedData, error } = await supabase.storage
    .from("uploads")
    .createSignedUrl(d.stored_filename, 3600); // 1 hour

  if (error || !signedData) {
    res.status(500).json({ error: error?.message ?? "Failed to create signed URL" });
    return;
  }

  res.json({ url: signedData.signedUrl });
});

// DELETE /goals/:goalId/tasks/:taskId/documents/:docId
router.delete("/:docId", async (req: Request<DocParams>, res) => {
  const { docId } = req.params;
  const supabase = createSupabaseClient(req.accessToken);

  // Get the document to find the storage path
  const { data: d } = await supabase
    .from("documents")
    .select("stored_filename")
    .eq("id", docId)
    .single();

  if (!d) { res.status(404).json({ error: "Document not found" }); return; }

  // Delete from Supabase Storage
  await supabase.storage.from("uploads").remove([d.stored_filename]);

  // Delete from DB
  const { error } = await supabase.from("documents").delete().eq("id", docId);
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(204).send();
});

export default router;
