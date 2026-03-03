"use client";

import { useRef, useState } from "react";

type FileUploadProps = {
  onUpload: (file: File) => Promise<void>;
};

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export default function FileUpload({ onUpload }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  function isValidFile(file: File): boolean {
    return ACCEPTED_TYPES.includes(file.type);
  }

  async function uploadFiles(files: File[]) {
    const valid = files.filter(isValidFile);
    if (valid.length === 0) return;
    setUploading(true);
    setUploadCount(valid.length);
    try {
      for (const file of valid) {
        await onUpload(file);
      }
    } finally {
      setUploading(false);
      setUploadCount(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(Array.from(files));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await uploadFiles(files);
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`
        flex cursor-pointer flex-col items-center justify-center gap-1
        rounded-xl border-2 border-dashed p-6 transition-colors
        ${isDragOver
          ? "border-accent bg-accent/10"
          : "border-border hover:border-accent/50 hover:bg-surface-1"
        }
        ${uploading ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        multiple
        onChange={handleChange}
        className="hidden"
      />
      {uploading ? (
        <p className="text-sm text-muted-foreground">
          Uploading{uploadCount > 1 ? ` ${uploadCount} files` : ""}...
        </p>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">
            {isDragOver ? "Drop files here" : "Drag files here or click to upload"}
          </p>
          <p className="text-xs text-muted-foreground">PDF, PNG, JPEG · Max 10 MB</p>
        </>
      )}
    </div>
  );
}
