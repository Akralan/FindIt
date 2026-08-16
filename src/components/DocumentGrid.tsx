"use client";

import type { ReactNode } from "react";
import type { DocumentSummary } from "@/lib/types";
import { DocumentCard } from "@/components/DocumentCard";

export interface DocumentGridProps {
  documents: DocumentSummary[];
  loading?: boolean;
  onOpen: (document: DocumentSummary) => void;
  onValidate?: (document: DocumentSummary) => Promise<void> | void;
  onReject?: (document: DocumentSummary) => Promise<void> | void;
  emptyState?: ReactNode;
  skeletonCount?: number;
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="h-4 w-2/3 animate-pulse rounded bg-surface-hover" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-surface-hover" />
      <div className="h-3 w-full animate-pulse rounded bg-surface-hover" />
      <div className="h-3 w-4/5 animate-pulse rounded bg-surface-hover" />
      <div className="flex gap-1.5">
        <div className="h-5 w-16 animate-pulse rounded-full bg-surface-hover" />
        <div className="h-5 w-12 animate-pulse rounded-full bg-surface-hover" />
      </div>
    </div>
  );
}

export function DocumentGrid({
  documents,
  loading = false,
  onOpen,
  onValidate,
  onReject,
  emptyState,
  skeletonCount = 6,
}: DocumentGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border px-6 py-12 text-center">
        {emptyState}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
          onOpen={onOpen}
          onValidate={onValidate}
          onReject={onReject}
        />
      ))}
    </div>
  );
}
