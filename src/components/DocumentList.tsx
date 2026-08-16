"use client";

import type { ReactNode } from "react";
import type { DocumentSummary } from "@/lib/types";
import { DocumentRow } from "@/components/DocumentRow";

export interface DocumentListProps {
  documents: DocumentSummary[];
  variant: "pending" | "library" | "search";
  loading?: boolean;
  onOpen: (document: DocumentSummary) => void;
  onValidate?: (document: DocumentSummary) => Promise<void> | void;
  onReject?: (document: DocumentSummary) => Promise<void> | void;
  emptyState?: ReactNode;
  skeletonCount?: number;
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-5 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="h-4 w-1/3 animate-pulse rounded bg-surface-hover" />
        <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-surface-hover" />
      </div>
      <div className="h-5 w-16 flex-none animate-pulse rounded-full bg-surface-hover" />
    </div>
  );
}

export function DocumentList({
  documents,
  variant,
  loading = false,
  onOpen,
  onValidate,
  onReject,
  emptyState,
  skeletonCount = 3,
}: DocumentListProps) {
  if (loading) {
    return (
      <div className="divide-y divide-border-subtle overflow-hidden rounded-card-lg border border-border bg-surface">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <RowSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    if (!emptyState) return null;
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-card-lg border border-dashed border-border bg-surface px-6 py-14 text-center">
        {emptyState}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-subtle overflow-hidden rounded-card-lg border border-border bg-surface">
      {documents.map((document) => (
        <DocumentRow
          key={document.id}
          document={document}
          variant={variant}
          onOpen={onOpen}
          onValidate={onValidate}
          onReject={onReject}
        />
      ))}
    </div>
  );
}
