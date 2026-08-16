"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import type { DocumentSummary } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface DocumentCardProps {
  document: DocumentSummary;
  onOpen: (document: DocumentSummary) => void;
  onValidate?: (document: DocumentSummary) => Promise<void> | void;
  onReject?: (document: DocumentSummary) => Promise<void> | void;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(
      new Date(iso)
    );
  } catch {
    return "";
  }
}

function fileKindLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "text/markdown") return "Markdown";
  if (mimeType === "text/plain") return "Texte";
  return "Fichier";
}

export function DocumentCard({ document, onOpen, onValidate, onReject }: DocumentCardProps) {
  const [pendingAction, setPendingAction] = useState<"validate" | "reject" | null>(null);
  const isPending = document.status === "pending_review";

  async function handleValidate(event: MouseEvent) {
    event.stopPropagation();
    if (!onValidate) return;
    setPendingAction("validate");
    try {
      await onValidate(document);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReject(event: MouseEvent) {
    event.stopPropagation();
    if (!onReject) return;
    setPendingAction("reject");
    try {
      await onReject(document);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(document)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(document);
      }}
      className="flex cursor-pointer flex-col gap-3 rounded-card border border-border bg-surface p-4 text-left transition-colors hover:border-accent/40 hover:bg-surface-hover"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text">{document.currentName}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          {fileKindLabel(document.mimeType)}
          {document.documentDate ? ` · ${formatDate(document.documentDate)}` : ""}
        </p>
      </div>

      {document.summary && (
        <p className="line-clamp-2 text-sm text-text-muted">{document.summary}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="accent">{document.category}</Badge>
      </div>

      {isPending && (onValidate || onReject) && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          {onValidate && (
            <Button
              size="sm"
              variant="primary"
              isLoading={pendingAction === "validate"}
              disabled={pendingAction !== null}
              onClick={handleValidate}
            >
              Valider
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={pendingAction !== null}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(document);
            }}
          >
            Modifier
          </Button>
          {onReject && (
            <Button
              size="sm"
              variant="danger"
              isLoading={pendingAction === "reject"}
              disabled={pendingAction !== null}
              onClick={handleReject}
              className="ml-auto"
            >
              Rejeter
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
