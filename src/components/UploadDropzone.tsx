"use client";

import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import clsx from "clsx";
import type { DocumentRecord } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export interface UploadDropzoneProps {
  onUploaded: (documents: DocumentRecord[]) => void;
  /** "compact" : ligne discrète (bibliothèque non vide). "full" : gros dropzone (état vide). */
  variant?: "compact" | "full";
}

const ACCEPTED_INPUT =
  "image/*,.pdf,application/pdf,.txt,text/plain,.md,text/markdown";

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path
        d="M10 13V3M10 3L6 7M10 3L14 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 13v2a2 2 0 002 2h10a2 2 0 002-2v-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UploadDropzone({ onUploaded, variant = "full" }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setIsUploading(true);
      try {
        const formData = new FormData();
        for (const file of fileArray) {
          formData.append("files", file);
        }

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error ?? "Échec de l'envoi des documents.");
        }

        const documents = (data.documents ?? []) as DocumentRecord[];
        onUploaded(documents);
        showToast(
          documents.length > 1
            ? `${documents.length} documents importés, en attente de validation.`
            : "Document importé, en attente de validation.",
          "success"
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Échec de l'envoi des documents.";
        showToast(message, "error");
      } finally {
        setIsUploading(false);
      }
    },
    [onUploaded, showToast]
  );

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files?.length) {
      void uploadFiles(event.dataTransfer.files);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) {
      void uploadFiles(event.target.files);
    }
    event.target.value = "";
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPTED_INPUT}
      onChange={handleInputChange}
      className="hidden"
    />
  );

  if (variant === "compact") {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={clsx(
          "flex items-center gap-4 rounded-card-lg border bg-surface px-[18px] py-3.5 transition-colors",
          isDragging ? "border-accent bg-accent/5" : "border-border",
          isUploading && "opacity-70"
        )}
      >
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-accent/10 text-accent">
          <UploadIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-5 text-text">
            {isUploading ? "Import en cours..." : "Déposez un document"}
          </p>
          <p className="mt-0.5 text-[13px] leading-[18px] text-text-muted">
            Images, PDF, texte ou Markdown — nommé et classé automatiquement
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="ml-auto h-[38px] flex-none rounded-card border border-border bg-surface px-4 text-[13px] font-medium text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Parcourir
        </button>
        {fileInput}
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={clsx(
        "flex w-full flex-col items-center gap-3.5 rounded-[18px] border-[1.5px] border-dashed bg-surface px-8 py-12 text-center transition-colors",
        isDragging ? "border-accent bg-accent/5" : "border-border",
        isUploading && "opacity-70"
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <UploadIcon className="h-[22px] w-[22px]" />
      </div>
      <div>
        <p className="text-[15px] font-medium leading-[22px] text-text">
          {isUploading ? "Import en cours..." : "Glissez-déposez vos documents ici"}
        </p>
        <p className="mt-1 text-[13px] leading-[18px] text-text-muted">Images, PDF, texte ou Markdown</p>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="h-10 rounded-[10px] bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Parcourir les fichiers
      </button>
      {fileInput}
    </div>
  );
}
