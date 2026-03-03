-- Supabase Migration: Create all tables with RLS
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ============================================================
-- GOALS
-- ============================================================
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_date date,
  "order" integer default 0,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "Users can read own goals"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.goals for update
  using (auth.uid() = user_id);

create policy "Users can delete own goals"
  on public.goals for delete
  using (auth.uid() = user_id);

-- ============================================================
-- TASKS
-- ============================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  weight numeric not null default 1,
  completed boolean not null default false,
  due_date date,
  "order" integer default 0,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "Users can read own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- ============================================================
-- SUBSTEPS
-- ============================================================
create table public.substeps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.substeps enable row level security;

create policy "Users can read own substeps"
  on public.substeps for select
  using (auth.uid() = user_id);

create policy "Users can insert own substeps"
  on public.substeps for insert
  with check (auth.uid() = user_id);

create policy "Users can update own substeps"
  on public.substeps for update
  using (auth.uid() = user_id);

create policy "Users can delete own substeps"
  on public.substeps for delete
  using (auth.uid() = user_id);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  filename text not null,
  stored_filename text not null,
  mimetype text not null,
  size integer not null,
  uploaded_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "Users can read own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on public.documents for update
  using (auth.uid() = user_id);

create policy "Users can delete own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

-- ============================================================
-- SESSIONS (study sessions)
-- ============================================================
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  goal_id uuid not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  title text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create policy "Users can read own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- ============================================================
-- SEMESTERS
-- ============================================================
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  year integer not null,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.semesters enable row level security;

create policy "Users can read own semesters"
  on public.semesters for select
  using (auth.uid() = user_id);

create policy "Users can insert own semesters"
  on public.semesters for insert
  with check (auth.uid() = user_id);

create policy "Users can update own semesters"
  on public.semesters for update
  using (auth.uid() = user_id);

create policy "Users can delete own semesters"
  on public.semesters for delete
  using (auth.uid() = user_id);

-- ============================================================
-- PERIODS
-- ============================================================
create table public.periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.periods enable row level security;

create policy "Users can read own periods"
  on public.periods for select
  using (auth.uid() = user_id);

create policy "Users can insert own periods"
  on public.periods for insert
  with check (auth.uid() = user_id);

create policy "Users can update own periods"
  on public.periods for update
  using (auth.uid() = user_id);

create policy "Users can delete own periods"
  on public.periods for delete
  using (auth.uid() = user_id);

-- ============================================================
-- COURSES
-- ============================================================
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  grading_mode text not null check (grading_mode in ('letter', 'pf')),
  grade text not null,
  credits numeric not null,
  goal_ids jsonb not null default '[]'::jsonb,
  goal_grades jsonb not null default '{}'::jsonb,
  period_id uuid references public.periods(id) on delete set null,
  parts jsonb,
  "order" integer default 0,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

create policy "Users can read own courses"
  on public.courses for select
  using (auth.uid() = user_id);

create policy "Users can insert own courses"
  on public.courses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own courses"
  on public.courses for update
  using (auth.uid() = user_id);

create policy "Users can delete own courses"
  on public.courses for delete
  using (auth.uid() = user_id);

-- ============================================================
-- STUDY TIME GOALS
-- ============================================================
create table public.study_time_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  target_minutes integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.study_time_goals enable row level security;

create policy "Users can read own study_time_goals"
  on public.study_time_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own study_time_goals"
  on public.study_time_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own study_time_goals"
  on public.study_time_goals for update
  using (auth.uid() = user_id);

create policy "Users can delete own study_time_goals"
  on public.study_time_goals for delete
  using (auth.uid() = user_id);
