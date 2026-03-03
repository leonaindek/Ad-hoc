export interface Substep {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface TaskDocument {
  id: string;
  taskId: string;
  filename: string;
  storedFilename: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
}

export interface Task {
  id: string;
  goalId: string;
  title: string;
  weight: number;
  completed: boolean;
  dueDate?: string;
  createdAt: string;
  substeps?: Substep[];
  documents?: TaskDocument[];
}

export interface Goal {
  id: string;
  title: string;
  dueDate?: string;
  tasks: Task[];
  order?: number;
  createdAt: string;
}

export interface StudySession {
  id: string;
  taskId: string;
  goalId: string;
  date: string;
  startTime: string;
  endTime: string;
  title?: string;
  notes?: string;
  createdAt: string;
}

export type CreateGoalPayload = { title: string; dueDate?: string };
export type UpdateGoalPayload = Partial<Pick<Goal, "title" | "dueDate">>;
export type CreateTaskPayload = { goalId: string; title: string; weight: number; dueDate?: string };
export type UpdateTaskPayload = Partial<Pick<Task, "title" | "weight" | "completed" | "dueDate">>;
export type CreateSubstepPayload = { title: string };
export type UpdateSubstepPayload = Partial<Pick<Substep, "title" | "completed">>;

// Semesters & Periods
export interface Semester {
  id: string;
  name: string;
  year: number;
  order: number;
  createdAt: string;
}

export interface Period {
  id: string;
  semesterId: string;
  name: string;
  order: number;
  createdAt: string;
}

export type CreateSemesterPayload = { name: string; year: number };
export type UpdateSemesterPayload = Partial<Pick<Semester, "name" | "year" | "order">>;
export type CreatePeriodPayload = { semesterId: string; name: string };
export type UpdatePeriodPayload = Partial<Pick<Period, "name" | "order">>;

// Courses
export type LetterGrade = "A" | "B" | "C" | "D" | "E" | "F";
export type PassFailGrade = "P" | "F";
export type GradingMode = "letter" | "pf";

export const GRADE_VALUES: Record<LetterGrade, number> = {
  A: 5,
  B: 4.5,
  C: 4,
  D: 3.5,
  E: 3,
  F: 0,
};

export interface CoursePart {
  id: string;
  name: string;
  credits: number;
  gradingMode: GradingMode;
  grade: LetterGrade | PassFailGrade;
  periodId?: string;
}

export interface Course {
  id: string;
  title: string;
  gradingMode: GradingMode;
  grade: LetterGrade | PassFailGrade;
  credits: number;
  goalIds: string[];
  goalGrades: Record<string, string>;
  periodId?: string;
  parts?: CoursePart[];
  order?: number;
  createdAt: string;
}

export type CreateCoursePayload = {
  title: string;
  gradingMode: GradingMode;
  grade: LetterGrade | PassFailGrade;
  credits: number;
  goalIds?: string[];
  goalGrades?: Record<string, string>;
  periodId?: string;
  parts?: CoursePart[];
};

export type UpdateCoursePayload = Partial<Omit<CreateCoursePayload, "periodId" | "parts">> & {
  periodId?: string | null;
  parts?: CoursePart[] | null;
};

// Study Time Goals
export interface StudyTimeGoal {
  id: string;
  date: string;
  targetMinutes: number;
  createdAt: string;
}
export type CreateStudyTimeGoalPayload = { date: string; targetMinutes: number };
export type UpdateStudyTimeGoalPayload = Partial<Pick<StudyTimeGoal, "targetMinutes">>;

export type CreateSessionPayload = {
  taskId: string;
  goalId: string;
  date: string;
  startTime: string;
  endTime: string;
  title?: string;
  notes?: string;
};
export type UpdateSessionPayload = Partial<Pick<StudySession, "date" | "startTime" | "endTime" | "title" | "notes">>;
