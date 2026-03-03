"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type CreateGoalModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, dueDate?: string) => Promise<void>;
};

export default function CreateGoalModal({ open, onClose, onCreate }: CreateGoalModalProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onCreate(trimmed, dueDate || undefined);
      setTitle("");
      setDueDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setTitle("");
    setDueDate("");
    setError("");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <h2 className="mb-5 text-lg font-semibold text-foreground">
        New Goal
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Goal title"
          id="goal-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Final Exam — Biology"
          error={error}
          autoFocus
        />
        <Input
          label="Due date (optional)"
          id="goal-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
