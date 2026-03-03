import type {
  Goal,
  Task,
  Substep,
  TaskDocument,
  StudySession,
  StudyTimeGoal,
  Course,
  Semester,
  Period,
  CreateGoalPayload,
  UpdateGoalPayload,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateSubstepPayload,
  UpdateSubstepPayload,
  CreateSessionPayload,
  UpdateSessionPayload,
  CreateStudyTimeGoalPayload,
  UpdateStudyTimeGoalPayload,
  CreateCoursePayload,
  UpdateCoursePayload,
  CreateSemesterPayload,
  UpdateSemesterPayload,
  CreatePeriodPayload,
  UpdatePeriodPayload,
} from "@/types";
import { createClient } from "@/lib/supabase/client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getGoals: () => request<Goal[]>("/goals"),

  getGoal: (goalId: string) => request<Goal>(`/goals/${goalId}`),

  createGoal: (payload: CreateGoalPayload) =>
    request<Goal>("/goals", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateGoal: (goalId: string, payload: UpdateGoalPayload) =>
    request<Goal>(`/goals/${goalId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteGoal: (id: string) =>
    request<void>(`/goals/${id}`, { method: "DELETE" }),

  reorderGoals: (goalIds: string[]) =>
    request<Goal[]>("/goals/reorder", {
      method: "PUT",
      body: JSON.stringify({ goalIds }),
    }),

  createTask: (goalId: string, payload: Omit<CreateTaskPayload, "goalId">) =>
    request<Task>(`/goals/${goalId}/tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateTask: (goalId: string, taskId: string, payload: UpdateTaskPayload) =>
    request<Task>(`/goals/${goalId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteTask: (goalId: string, taskId: string) =>
    request<void>(`/goals/${goalId}/tasks/${taskId}`, { method: "DELETE" }),

  reorderTasks: (goalId: string, taskIds: string[]) =>
    request<Task[]>(`/goals/${goalId}/tasks/reorder`, {
      method: "PUT",
      body: JSON.stringify({ taskIds }),
    }),

  // Substeps
  createSubstep: (goalId: string, taskId: string, payload: CreateSubstepPayload) =>
    request<Substep>(`/goals/${goalId}/tasks/${taskId}/substeps`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateSubstep: (goalId: string, taskId: string, substepId: string, payload: UpdateSubstepPayload) =>
    request<Substep>(`/goals/${goalId}/tasks/${taskId}/substeps/${substepId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteSubstep: (goalId: string, taskId: string, substepId: string) =>
    request<void>(`/goals/${goalId}/tasks/${taskId}/substeps/${substepId}`, { method: "DELETE" }),

  // Documents
  async uploadDocument(goalId: string, taskId: string, file: File): Promise<TaskDocument> {
    const token = await getAccessToken();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/goals/${goalId}/tasks/${taskId}/documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  },

  deleteDocument: (goalId: string, taskId: string, docId: string) =>
    request<void>(`/goals/${goalId}/tasks/${taskId}/documents/${docId}`, { method: "DELETE" }),

  async getDocumentUrl(_goalId: string, _taskId: string, docId: string): Promise<string> {
    const { url } = await request<{ url: string }>(`/documents/${docId}/file`);
    return url;
  },

  // Sessions
  getSessions: (params?: { month?: string; date?: string }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set("month", params.month);
    if (params?.date) query.set("date", params.date);
    const qs = query.toString();
    return request<StudySession[]>(`/sessions${qs ? `?${qs}` : ""}`);
  },

  createSession: (payload: CreateSessionPayload) =>
    request<StudySession>("/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateSession: (id: string, payload: UpdateSessionPayload) =>
    request<StudySession>(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteSession: (id: string) =>
    request<void>(`/sessions/${id}`, { method: "DELETE" }),

  // Study Time Goals
  getStudyTimeGoals: (date?: string) => {
    const qs = date ? `?date=${date}` : "";
    return request<StudyTimeGoal[]>(`/study-goals${qs}`);
  },

  createStudyTimeGoal: (payload: CreateStudyTimeGoalPayload) =>
    request<StudyTimeGoal>("/study-goals", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateStudyTimeGoal: (id: string, payload: UpdateStudyTimeGoalPayload) =>
    request<StudyTimeGoal>(`/study-goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteStudyTimeGoal: (id: string) =>
    request<void>(`/study-goals/${id}`, { method: "DELETE" }),

  // Courses
  getCourses: () => request<Course[]>("/courses"),

  createCourse: (payload: CreateCoursePayload) =>
    request<Course>("/courses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateCourse: (id: string, payload: UpdateCoursePayload) =>
    request<Course>(`/courses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteCourse: (id: string) =>
    request<void>(`/courses/${id}`, { method: "DELETE" }),

  reorderCourses: (courseIds: string[]) =>
    request<Course[]>("/courses/reorder", {
      method: "PUT",
      body: JSON.stringify({ courseIds }),
    }),

  // Semesters
  getSemesters: () => request<Semester[]>("/semesters"),

  createSemester: (payload: CreateSemesterPayload) =>
    request<Semester>("/semesters", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateSemester: (id: string, payload: UpdateSemesterPayload) =>
    request<Semester>(`/semesters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteSemester: (id: string) =>
    request<void>(`/semesters/${id}`, { method: "DELETE" }),

  // Periods
  getPeriods: (semesterId?: string) => {
    const qs = semesterId ? `?semesterId=${semesterId}` : "";
    return request<Period[]>(`/periods${qs}`);
  },

  createPeriod: (payload: CreatePeriodPayload) =>
    request<Period>("/periods", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updatePeriod: (id: string, payload: UpdatePeriodPayload) =>
    request<Period>(`/periods/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deletePeriod: (id: string) =>
    request<void>(`/periods/${id}`, { method: "DELETE" }),

  // AI (Gemini) — calls Next.js API routes (same origin, cookies handle auth)
  correctExam: async (documentId: string, description?: string) => {
    const res = await fetch("/api/correct-exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, description }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json() as Promise<{
      corrections: {
        question: string;
        issue: string;
        modelAnswer: string;
        explanation: string;
      }[];
      overallFeedback: string;
    }>;
  },

  analyseWeakness: async (payload: {
    description: string;
    scores: { question: string; score: number; maxScore: number }[];
  }) => {
    const res = await fetch("/api/analyse-weakness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json() as Promise<{
      weaknesses: {
        topic: string;
        priority: string;
        reason: string;
        studyTips: string;
      }[];
    }>;
  },
};
