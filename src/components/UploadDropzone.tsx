"use client";

import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import clsx from "clsx";
import type { DocumentRecord } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export interface UploadDropzoneProps {
  onUploaded: (documents: DocumentRecord[]) => void;
}

const ACCEPTED_INPUT =
  "image/*,.pdf,application/pdf,.txt,text/plain,.md,text/markdown";

export function UploadDropzone({ onUploaded }: UploadDropzoneProps) {
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

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={clsx(
        "flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors",
        isDragging ? "border-accent bg-accent/5" : "border-border bg-surface",
        isUploading && "opacity-70"
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-hover text-text-muted">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
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
      </div>
      <div>
        <p className="text-sm font-medium text-text">
          {isUploading ? "Import en cours..." : "Glissez-déposez vos documents ici"}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Images, PDF, texte ou Markdown — classement automatique par IA
        </p>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="inline-flex h-9 items-center rounded-card border border-border bg-surface px-4 text-sm font-medium text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Parcourir les fichiers
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_INPUT}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
