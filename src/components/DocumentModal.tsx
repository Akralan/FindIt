"use client";

import { useEffect, useState } from "react";
import type { DocumentRecord, DocumentStatus } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export interface DocumentModalProps {
  documentId: string | null;
  onClose: () => void;
  onChanged: (document: DocumentRecord) => void;
  onDeleted: (id: string) => void;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

type Patch = Partial<Pick<DocumentRecord, "currentName" | "category" | "status">>;

export function DocumentModal({ documentId, onClose, onChanged, onDeleted }: DocumentModalProps) {
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const { showToast } = useToast();

  const isOpen = documentId !== null;

  useEffect(() => {
    if (!documentId) {
      setDocument(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDocument(null);
    setConfirmingDelete(false);

    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Document introuvable.");
        if (!cancelled) setDocument(data.document as DocumentRecord);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Document introuvable.";
          showToast(message, "error");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  useEffect(() => {
    if (document) {
      setNameInput(document.currentName);
      setCategoryInput(document.category);
    }
  }, [document]);

  function buildPatch(explicitStatus?: DocumentStatus): Patch {
    if (!document) return {};
    const patch: Patch = {};
    const trimmedName = nameInput.trim();
    const trimmedCategory = categoryInput.trim();

    if (trimmedName && trimmedName !== document.currentName) patch.currentName = trimmedName;
    if (trimmedCategory && trimmedCategory !== document.category) patch.category = trimmedCategory;

    const finalStatus = explicitStatus ?? document.status;
    if (finalStatus !== document.status) patch.status = finalStatus;

    return patch;
  }

  async function submitPatch(patch: Patch, kind: "save" | "validate") {
    if (!document) return;
    const setter = kind === "save" ? setSaving : setValidating;
    setter(true);
    try {
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Échec de l'enregistrement.");
      const updated = data.document as DocumentRecord;
      setDocument(updated);
      onChanged(updated);
      showToast(kind === "validate" ? "Document validé." : "Document mis à jour.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'enregistrement.";
      showToast(message, "error");
    } finally {
      setter(false);
    }
  }

  async function handleSave() {
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      showToast("Aucune modification à enregistrer.", "info");
      return;
    }
    await submitPatch(patch, "save");
  }

  async function handleValidate() {
    const patch = buildPatch("confirmed");
    patch.status = "confirmed";
    await submitPatch(patch, "validate");
  }

  async function handleDelete() {
    if (!document) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Échec de la suppression.");
      showToast("Document déplacé vers la corbeille.", "success");
      onDeleted(document.id);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de la suppression.";
      showToast(message, "error");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  async function handleReveal() {
    if (!document) return;
    setRevealing(true);
    try {
      const res = await fetch(`/api/documents/${document.id}/reveal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Impossible d'ouvrir l'Explorateur.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible d'ouvrir l'Explorateur.";
      showToast(message, "error");
    } finally {
      setRevealing(false);
    }
  }

  async function handleUndo() {
    if (!document) return;
    setUndoing(true);
    try {
      const res = await fetch(`/api/documents/${document.id}/undo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Impossible d'annuler cette modification.");
      const updated = data.document as DocumentRecord;
      setDocument(updated);
      onChanged(updated);
      showToast("Dernière modification annulée.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible d'annuler cette modification.";
      showToast(message, "error");
    } finally {
      setUndoing(false);
    }
  }

  const busy = saving || validating || deleting || undoing;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={document?.currentName ?? "Document"}
      maxWidthClassName="max-w-2xl"
      title={
        document ? (
          <>
            <div className="flex items-center gap-2.5">
              <Badge variant={document.status === "pending_review" ? "warning" : "success"}>
                {document.status === "pending_review" ? "À valider" : "Validé"}
              </Badge>
              <span className="truncate font-mono text-xs text-text-faint">{document.originalName}</span>
            </div>
            <h2 className="mt-2 truncate text-lg font-semibold leading-[26px] tracking-tight text-text">
              {document.currentName}
            </h2>
          </>
        ) : (
          <h2 className="text-lg font-semibold text-text">{loading ? "Chargement..." : "Document"}</h2>
        )
      }
      footer={
        document ? (
          confirmingDelete ? (
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-sm text-text-muted">
                Supprimer ce document ? Il sera déplacé vers la corbeille.
              </p>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                  Annuler
                </Button>
                <Button variant="danger-solid" size="sm" isLoading={deleting} onClick={handleDelete}>
                  Confirmer la suppression
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="danger" size="sm" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                Supprimer
              </Button>
              <div className="ml-auto flex items-center gap-2.5">
                <Button variant="secondary" size="sm" isLoading={saving} disabled={busy} onClick={handleSave}>
                  Enregistrer
                </Button>
                {document.status === "pending_review" && (
                  <Button variant="primary" size="sm" isLoading={validating} disabled={busy} onClick={handleValidate}>
                    Valider
                  </Button>
                )}
              </div>
            </>
          )
        ) : undefined
      }
    >
      {loading && (
        <div className="flex flex-col gap-4">
          <div className="h-4 w-1/2 animate-pulse rounded bg-surface-hover" />
          <div className="h-24 w-full animate-pulse rounded bg-surface-hover" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-hover" />
        </div>
      )}

      {!loading && document && (
        <div className="flex flex-col gap-[22px]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nom du fichier"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
            />
            <Input
              label="Catégorie"
              value={categoryInput}
              onChange={(event) => setCategoryInput(event.target.value)}
            />
          </div>

          {document.summary && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] font-medium text-text">Résumé</p>
              <p className="text-sm leading-[22px] text-text-muted">{document.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5 border-t border-border-subtle pt-[18px] sm:grid-cols-4">
            <div>
              <p className="text-xs text-text-faint">Taille</p>
              <p className="mt-[3px] font-mono text-[13px] text-text">{formatBytes(document.sizeBytes)}</p>
            </div>
            <div>
              <p className="text-xs text-text-faint">Date du document</p>
              <p className="mt-[3px] font-mono text-[13px] text-text">{document.documentDate ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-text-faint">Importé</p>
              <p className="mt-[3px] font-mono text-[13px] text-text">{formatDate(document.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-text-faint">Emplacement</p>
              <p className="mt-[3px] truncate font-mono text-[13px] text-text">{document.category}/</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="sm" isLoading={revealing} onClick={handleReveal}>
              Ouvrir dans l&apos;Explorateur
            </Button>
            <Button variant="ghost" size="sm" isLoading={undoing} disabled={busy} onClick={handleUndo}>
              Annuler la dernière modification
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
