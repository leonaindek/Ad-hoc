import "dotenv/config";
import express from "express";
import cors from "cors";
import { authMiddleware } from "./auth-middleware.js";
import goalRouter from "./routes/goals.js";
import sessionRouter from "./routes/sessions.js";
import courseRouter from "./routes/courses.js";
import semesterRouter from "./routes/semesters.js";
import periodRouter from "./routes/periods.js";
import studyGoalRouter from "./routes/study-goals.js";
import documentRouter from "./routes/documents.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

// All API routes require authentication
app.use(authMiddleware);

app.use("/goals", goalRouter);
app.use("/sessions", sessionRouter);
app.use("/courses", courseRouter);
app.use("/semesters", semesterRouter);
app.use("/periods", periodRouter);
app.use("/study-goals", studyGoalRouter);
// Top-level document file route for signed URL redirects
app.use("/documents", documentRouter);

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend server running on port ${PORT}`);
});
