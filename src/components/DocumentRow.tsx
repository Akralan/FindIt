"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import type { DocumentSummary } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface DocumentRowProps {
  document: DocumentSummary;
  /** "pending" : ligne à valider (actions inline). "library" : ligne cliquable simple.
   * "search" : ligne cliquable, résultat de recherche. */
  variant: "pending" | "library" | "search";
  onOpen: (document: DocumentSummary) => void;
  onValidate?: (document: DocumentSummary) => Promise<void> | void;
  onReject?: (document: DocumentSummary) => Promise<void> | void;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
      new Date(iso)
    );
  } catch {
    return "—";
  }
}

export function DocumentRow({ document, variant, onOpen, onValidate, onReject }: DocumentRowProps) {
  const [pendingAction, setPendingAction] = useState<"validate" | "reject" | null>(null);

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

  if (variant === "pending") {
    return (
      <div className="flex items-center gap-5 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <p className="truncate text-sm font-medium leading-5 text-text">{document.currentName}</p>
            <Badge variant="accent" className="flex-none">
              {document.category}
            </Badge>
          </div>
          {document.summary && (
            <p className="mt-[3px] truncate text-[13px] leading-[18px] text-text-muted">{document.summary}</p>
          )}
        </div>
        <div className="flex flex-none items-center gap-2">
          {onValidate && (
            <Button size="sm" variant="primary" isLoading={pendingAction === "validate"} disabled={pendingAction !== null} onClick={handleValidate}>
              Valider
            </Button>
          )}
          <Button size="sm" variant="secondary" disabled={pendingAction !== null} onClick={() => onOpen(document)}>
            Modifier
          </Button>
          {onReject && (
            <Button
              size="sm"
              variant="ghost"
              aria-label="Rejeter"
              isLoading={pendingAction === "reject"}
              disabled={pendingAction !== null}
              onClick={handleReject}
              className="w-8 px-0 text-base hover:!text-danger"
            >
              ×
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(document)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(document);
      }}
      className="flex cursor-pointer items-center gap-5 px-5 py-[15px] transition-colors hover:bg-surface-hover"
    >
      <div className="min-w-0 flex-1">
        {variant === "search" ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <p className="truncate text-sm font-medium leading-5 text-text">{document.currentName}</p>
            <Badge variant="accent" className="flex-none">
              {document.category}
            </Badge>
          </div>
        ) : (
          <p className="truncate text-sm font-medium leading-5 text-text">{document.currentName}</p>
        )}
        {document.summary && (
          <p className="mt-[3px] truncate text-[13px] leading-[18px] text-text-muted">{document.summary}</p>
        )}
      </div>
      {variant === "library" && (
        <Badge variant="default" className="flex-none">
          {document.category}
        </Badge>
      )}
      <span className="w-[88px] flex-none text-right font-mono text-xs text-text-faint">
        {formatDate(document.documentDate ?? document.createdAt)}
      </span>
    </div>
  );
}
