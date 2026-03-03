"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { computeSubstepProgress } from "@/lib/progress";
import type { Goal, Task, Substep, TaskDocument, StudySession } from "@/types";
import ProgressBar from "@/components/ProgressBar";
import SubstepItem from "@/components/SubstepItem";
import AddSubstepForm from "@/components/AddSubstepForm";
import DocumentList from "@/components/DocumentList";
import FileUpload from "@/components/FileUpload";
import SessionTimer from "@/components/SessionTimer";
import AddSessionForm from "@/components/AddSessionForm";
import SessionList from "@/components/SessionList";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type QuestionRow = { question: string; score: string; maxScore: string };
type Weakness = { topic: string; priority: string; reason: string; studyTips: string };

function ShimmerBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-shimmer rounded-lg ${className}`} />;
}

const priorityColors: Record<string, string> = {
  high: "bg-red-500/15 text-red-500",
  medium: "bg-yellow-500/15 text-yellow-500",
  low: "bg-green-500/15 text-green-500",
};

export default function TaskRoomPage() {
  const params = useParams<{ goalId: string; taskId: string }>();
  const router = useRouter();
  const { goalId, taskId } = params;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [substeps, setSubsteps] = useState<Substep[]>([]);
  const [documents, setDocuments] = useState<TaskDocument[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Analyse Weaknesses modal state
  const [weaknessModalOpen, setWeaknessModalOpen] = useState(false);
  const [weaknessDescription, setWeaknessDescription] = useState("");
  const [weaknessQuestions, setWeaknessQuestions] = useState<QuestionRow[]>([
    { question: "", score: "", maxScore: "" },
  ]);
  const [weaknessLoading, setWeaknessLoading] = useState(false);
  const [weaknessError, setWeaknessError] = useState("");
  const [weaknessResults, setWeaknessResults] = useState<Weakness[] | null>(null);

  const loadData = useCallback(async () => {
    try {
      const g = await api.getGoal(goalId);
      setGoal(g);
      const t = g.tasks.find((t) => t.id === taskId);
      if (!t) {
        setError("Task not found");
        return;
      }
      setTask(t);
      setSubsteps(t.substeps ?? []);
      setDocuments(t.documents ?? []);
      const allSessions = await api.getSessions();
      setSessions(allSessions.filter((s) => s.taskId === taskId));
    } catch {
      setError("Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [goalId, taskId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddSubstep(title: string) {
    const substep = await api.createSubstep(goalId, taskId, { title });
    setSubsteps((prev) => [...prev, substep]);
  }

  async function handleToggleSubstep(substep: Substep) {
    const updated = await api.updateSubstep(goalId, taskId, substep.id, {
      completed: !substep.completed,
    });
    setSubsteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function handleDeleteSubstep(substepId: string) {
    await api.deleteSubstep(goalId, taskId, substepId);
    setSubsteps((prev) => prev.filter((s) => s.id !== substepId));
  }

  async function handleUploadDocument(file: File) {
    const doc = await api.uploadDocument(goalId, taskId, file);
    setDocuments((prev) => [...prev, doc]);
  }

  async function handleDeleteDocument(docId: string) {
    await api.deleteDocument(goalId, taskId, docId);
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  function openWeaknessModal() {
    setWeaknessDescription("");
    setWeaknessQuestions([{ question: "", score: "", maxScore: "" }]);
    setWeaknessResults(null);
    setWeaknessError("");
    setWeaknessModalOpen(true);
  }

  function updateQuestionRow(index: number, field: keyof QuestionRow, value: string) {
    setWeaknessQuestions((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addQuestionRow() {
    setWeaknessQuestions((prev) => [...prev, { question: "", score: "", maxScore: "" }]);
  }

  function removeQuestionRow(index: number) {
    setWeaknessQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAnalyseSubmit() {
    const scores = weaknessQuestions
      .filter((q) => q.question.trim() && q.score && q.maxScore)
      .map((q) => ({
        question: q.question.trim(),
        score: Number(q.score),
        maxScore: Number(q.maxScore),
      }));
    if (!weaknessDescription.trim() || scores.length === 0) {
      setWeaknessError("Please fill in the description and at least one complete question row.");
      return;
    }
    setWeaknessLoading(true);
    setWeaknessError("");
    try {
      const result = await api.analyseWeakness({
        description: weaknessDescription.trim(),
        scores,
      });
      setWeaknessResults(result.weaknesses);
    } catch (err) {
      setWeaknessError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setWeaknessLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ShimmerBlock className="mb-6 h-4 w-48" />
        <ShimmerBlock className="mb-4 h-8 w-2/3" />
        <ShimmerBlock className="mb-8 h-2 w-full" />
        <ShimmerBlock className="mb-3 h-5 w-24" />
        <div className="space-y-2 mb-8">
          <ShimmerBlock className="h-8 w-full" />
          <ShimmerBlock className="h-8 w-full" />
          <ShimmerBlock className="h-8 w-5/6" />
        </div>
        <ShimmerBlock className="mb-3 h-5 w-28" />
        <ShimmerBlock className="h-20 w-full" />
      </div>
    );
  }

  if (error || !goal || !task) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-600">{error || "Something went wrong"}</p>
        <button onClick={() => router.push("/")} className="text-accent hover:underline text-sm">
          Back to dashboard
        </button>
      </div>
    );
  }

  const progress = computeSubstepProgress(substeps);

  // Sort weaknesses by priority: high > medium > low
  const sortedWeaknesses = weaknessResults
    ? [...weaknessResults].sort((a, b) => {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (order[a.priority.toLowerCase()] ?? 3) - (order[b.priority.toLowerCase()] ?? 3);
      })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/" className="hover:text-foreground transition-colors">
          &larr; Back
        </Link>
        <span>/</span>
        <span className="truncate">{goal.title}</span>
        <span>/</span>
        <span className="truncate text-foreground">{task.title}</span>
      </div>

      {/* Task title */}
      <h1 className="mb-4 text-2xl font-bold text-foreground">
        {task.title}
      </h1>

      {/* Progress */}
      <div className="mb-8">
        <ProgressBar value={progress} />
      </div>

      {/* Sub-steps section */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Sub-steps
        </h2>
        <div className="border-b border-border mb-3" />
        <div className="flex flex-col gap-1 mb-3">
          {substeps.map((s) => (
            <SubstepItem
              key={s.id}
              substep={s}
              onToggle={handleToggleSubstep}
              onDelete={handleDeleteSubstep}
            />
          ))}
        </div>
        <AddSubstepForm onAdd={handleAddSubstep} />
      </section>

      {/* Documents section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">
            Documents
          </h2>
          <Button variant="ghost" className="text-xs" onClick={openWeaknessModal}>
            Analyse Weaknesses
          </Button>
        </div>
        <div className="border-b border-border mb-3" />
        <div className="mb-3">
          <DocumentList
            documents={documents}
            goalId={goalId}
            taskId={taskId}
            onDelete={handleDeleteDocument}
          />
        </div>
        <FileUpload onUpload={handleUploadDocument} />
      </section>

      {/* Study Sessions section */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Study Sessions
        </h2>
        <div className="border-b border-border mb-3" />
        <div className="mb-3">
          <SessionTimer
            taskId={taskId}
            goalId={goalId}
            onSessionCreated={(s) => setSessions((prev) => [...prev, s])}
          />
        </div>
        <div className="mb-3">
          <AddSessionForm
            taskId={taskId}
            goalId={goalId}
            onSessionCreated={(s) => setSessions((prev) => [...prev, s])}
          />
        </div>
        <SessionList
          sessions={sessions}
          onDelete={(id) => setSessions((prev) => prev.filter((s) => s.id !== id))}
        />
      </section>

      {/* Analyse Weaknesses Modal */}
      <Modal open={weaknessModalOpen} onClose={() => setWeaknessModalOpen(false)}>
        {!sortedWeaknesses ? (
          <>
            <h3 className="text-lg font-semibold text-foreground mb-4">Analyse Weaknesses</h3>
            <div className="flex flex-col gap-4">
              <Input
                label="Exam Description"
                placeholder="e.g. Final exam for Linear Algebra"
                value={weaknessDescription}
                onChange={(e) => setWeaknessDescription(e.target.value)}
              />
              <div>
                <label className="text-sm font-medium text-muted mb-2 block">Questions & Scores</label>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {weaknessQuestions.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Question"
                        value={row.question}
                        onChange={(e) => updateQuestionRow(i, "question", e.target.value)}
                        className="flex-1 min-w-0 rounded-lg border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                      <input
                        type="number"
                        placeholder="Score"
                        value={row.score}
                        onChange={(e) => updateQuestionRow(i, "score", e.target.value)}
                        className="w-16 rounded-lg border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                      <span className="text-muted text-xs">/</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={row.maxScore}
                        onChange={(e) => updateQuestionRow(i, "maxScore", e.target.value)}
                        className="w-16 rounded-lg border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                      {weaknessQuestions.length > 1 && (
                        <button
                          onClick={() => removeQuestionRow(i)}
                          className="text-red-500 hover:text-red-400 text-xs shrink-0"
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addQuestionRow}
                  className="mt-2 text-xs text-accent hover:underline"
                >
                  + Add Question
                </button>
              </div>
              {weaknessError && (
                <p className="text-xs text-red-500">{weaknessError}</p>
              )}
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="ghost" onClick={() => setWeaknessModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAnalyseSubmit} disabled={weaknessLoading}>
                  {weaknessLoading ? "Analysing..." : "Analyse"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-foreground mb-4">Weakness Analysis</h3>
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              {sortedWeaknesses.map((w, i) => {
                const pKey = w.priority.toLowerCase();
                const badgeClass = priorityColors[pKey] ?? "bg-surface-2 text-muted";
                return (
                  <div key={i} className="rounded-xl border border-border bg-surface-1 p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                        {w.priority}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground">{w.topic}</h4>
                    </div>
                    <p className="text-sm text-foreground">{w.reason}</p>
                    <div>
                      <span className="text-xs font-medium text-accent">Study Tips: </span>
                      <span className="text-sm text-muted-foreground">{w.studyTips}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="ghost" onClick={() => setWeaknessModalOpen(false)}>
                Close
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
