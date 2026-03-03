"use client";

import { useEffect, useState } from "react";
import type { TaskDocument } from "@/types";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";

type Correction = {
  question: string;
  issue: string;
  modelAnswer: string;
  explanation: string;
};

type CorrectionResult = {
  corrections: Correction[];
  overallFeedback: string;
};

type DocumentListProps = {
  documents: TaskDocument[];
  goalId: string;
  taskId: string;
  onDelete: (docId: string) => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimetype: string): boolean {
  return mimetype === "image/png" || mimetype === "image/jpeg";
}

function isPdf(mimetype: string): boolean {
  return mimetype === "application/pdf";
}

export default function DocumentList({ documents, goalId, taskId, onDelete }: DocumentListProps) {
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [correctingDocId, setCorrectingDocId] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, CorrectionResult>>({});
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [expandedCorrectionDocId, setExpandedCorrectionDocId] = useState<string | null>(null);

  // Fetch signed URLs for all documents
  useEffect(() => {
    let cancelled = false;
    async function fetchUrls() {
      const urls: Record<string, string> = {};
      for (const doc of documents) {
        try {
          const url = await api.getDocumentUrl(goalId, taskId, doc.id);
          if (cancelled) return;
          urls[doc.id] = url;
        } catch {
          // skip failed URLs
        }
      }
      if (!cancelled) setSignedUrls(urls);
    }
    if (documents.length > 0) fetchUrls();
    return () => { cancelled = true; };
  }, [documents, goalId, taskId]);

  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents yet.</p>;
  }

  function togglePreview(docId: string) {
    setExpandedDocId((prev) => (prev === docId ? null : docId));
  }

  async function handleCorrectExam(docId: string) {
    setCorrectingDocId(docId);
    setCorrectionError(null);
    try {
      const result = await api.correctExam(docId);
      setCorrections((prev) => ({ ...prev, [docId]: result }));
      setExpandedCorrectionDocId(docId);
    } catch (err) {
      setCorrectionError(err instanceof Error ? err.message : "Failed to correct exam");
    } finally {
      setCorrectingDocId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {documents.map((doc) => {
        const fileUrl = signedUrls[doc.id];
        const isExpanded = expandedDocId === doc.id;
        const isCorrectionsExpanded = expandedCorrectionDocId === doc.id;
        const correctionResult = corrections[doc.id];
        const isCorrecting = correctingDocId === doc.id;
        return (
          <div key={doc.id} className="flex flex-col">
            <div className="group flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-3 shadow-sm">
              {isImage(doc.mimetype) && fileUrl ? (
                <img
                  src={fileUrl}
                  alt={doc.filename}
                  className="h-10 w-10 rounded-lg object-cover ring-1 ring-border"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-sm font-medium text-muted ring-1 ring-border">
                  {isPdf(doc.mimetype) ? "PDF" : "..."}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-foreground">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">{formatSize(doc.size)}</p>
              </div>
              {(isImage(doc.mimetype) || isPdf(doc.mimetype)) && fileUrl && (
                <Button
                  variant="ghost"
                  className="!px-1.5 !py-0.5 text-xs text-accent"
                  onClick={() => togglePreview(doc.id)}
                >
                  {isExpanded ? "Hide" : "View"}
                </Button>
              )}
              <Button
                variant="ghost"
                className="!px-1.5 !py-0.5 text-xs text-accent"
                disabled={isCorrecting}
                onClick={() => {
                  if (correctionResult) {
                    setExpandedCorrectionDocId(isCorrectionsExpanded ? null : doc.id);
                  } else {
                    handleCorrectExam(doc.id);
                  }
                }}
              >
                {isCorrecting ? "Correcting..." : correctionResult ? (isCorrectionsExpanded ? "Hide AI" : "AI Correct") : "AI Correct"}
              </Button>
              {fileUrl && (
                <a
                  href={fileUrl}
                  download={doc.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  Download
                </a>
              )}
              <Button
                variant="ghost"
                className="!px-1.5 !py-0.5 text-xs text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDelete(doc.id)}
              >
                Del
              </Button>
            </div>
            {isExpanded && fileUrl && (
              <div className="mt-2 mb-1 ml-2 mr-2">
                {isImage(doc.mimetype) ? (
                  <img
                    src={fileUrl}
                    alt={doc.filename}
                    className="max-w-full rounded-lg"
                  />
                ) : isPdf(doc.mimetype) ? (
                  <iframe
                    src={fileUrl}
                    title={doc.filename}
                    className="w-full h-[600px] rounded-lg border border-border"
                  />
                ) : null}
              </div>
            )}
            {isCorrecting && (
              <div className="mt-2 ml-2 mr-2 flex items-center gap-2 rounded-xl border border-border bg-surface-1 p-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span className="text-sm text-muted">Analysing document with AI...</span>
              </div>
            )}
            {correctionError && correctingDocId === null && (
              <div className="mt-2 ml-2 mr-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm text-red-500">{correctionError}</p>
              </div>
            )}
            {isCorrectionsExpanded && correctionResult && (
              <div className="mt-2 ml-2 mr-2 flex flex-col gap-3">
                {/* Overall feedback */}
                <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                  <h4 className="text-sm font-semibold text-accent mb-1">Overall Feedback</h4>
                  <p className="text-sm text-foreground leading-relaxed">{correctionResult.overallFeedback}</p>
                </div>
                {/* Individual corrections */}
                {correctionResult.corrections.map((c, i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface-1 p-4 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-xs font-bold text-red-500">
                        {i + 1}
                      </span>
                      <h5 className="text-sm font-semibold text-foreground">{c.question}</h5>
                    </div>
                    <div className="ml-7 flex flex-col gap-1.5">
                      <div>
                        <span className="text-xs font-medium text-red-400">Issue: </span>
                        <span className="text-sm text-foreground">{c.issue}</span>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-green-400">Model Answer: </span>
                        <span className="text-sm text-foreground">{c.modelAnswer}</span>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-muted">Explanation: </span>
                        <span className="text-sm text-muted-foreground">{c.explanation}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
