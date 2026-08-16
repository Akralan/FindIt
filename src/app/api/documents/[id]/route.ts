import { NextResponse } from "next/server";

import type { DocumentEventType, DocumentRecord, DocumentStatus } from "@/lib/types";
import { deleteDocument, getDocument, updateDocument } from "@/lib/db/documents";
import { logEvent } from "@/lib/db/events";
import { deleteFileToTrash, moveFile } from "@/lib/storage/files";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

function isDocumentStatus(value: unknown): value is DocumentStatus {
  return value === "pending_review" || value === "confirmed";
}

interface PatchBody {
  currentName?: string;
  category?: string;
  tags?: string[];
  status?: DocumentStatus;
}

function isValidPatchBody(body: unknown): body is PatchBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (b.currentName !== undefined && typeof b.currentName !== "string") return false;
  if (b.category !== undefined && typeof b.category !== "string") return false;
  if (b.tags !== undefined && (!Array.isArray(b.tags) || !b.tags.every((t) => typeof t === "string"))) {
    return false;
  }
  if (b.status !== undefined && !isDocumentStatus(b.status)) return false;
  return true;
}

/**
 * GET /api/documents/:id
 */
export async function GET(_req: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const document = await getDocument(params.id);
    if (!document) {
      return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

/**
 * PATCH /api/documents/:id
 * body: Partial<Pick<DocumentRecord, "currentName"|"category"|"tags"|"status">>
 */
export async function PATCH(req: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const existing = await getDocument(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
    }

    if (!isValidPatchBody(rawBody)) {
      return NextResponse.json(
        { error: "Corps de requête invalide : champs acceptés \"currentName\", \"category\", \"tags\", \"status\"." },
        { status: 400 }
      );
    }

    const body = rawBody;
    const patch: Partial<DocumentRecord> = {};
    const before: Partial<DocumentRecord> = {};
    const after: Partial<DocumentRecord> = {};

    if (body.currentName !== undefined && body.currentName !== existing.currentName) {
      before.currentName = existing.currentName;
      after.currentName = body.currentName;
      patch.currentName = body.currentName;
    }
    if (body.category !== undefined && body.category !== existing.category) {
      before.category = existing.category;
      after.category = body.category;
      patch.category = body.category;
    }
    if (body.tags !== undefined && JSON.stringify(body.tags) !== JSON.stringify(existing.tags)) {
      before.tags = existing.tags;
      after.tags = body.tags;
      patch.tags = body.tags;
    }
    if (body.status !== undefined && body.status !== existing.status) {
      before.status = existing.status;
      after.status = body.status;
      patch.status = body.status;
    }

    // Déplace le fichier physique si le nom et/ou la catégorie changent.
    if (patch.currentName !== undefined || patch.category !== undefined) {
      const newCategory = patch.category ?? existing.category;
      const newName = patch.currentName ?? existing.currentName;
      const newFilePath = await moveFile(existing.filePath, newCategory, newName);
      before.filePath = existing.filePath;
      after.filePath = newFilePath;
      patch.filePath = newFilePath;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ document: existing });
    }

    patch.updatedAt = new Date().toISOString();
    const updated = await updateDocument(params.id, patch);

    let eventType: DocumentEventType = "edit";
    if (patch.category !== undefined) {
      eventType = "move";
    } else if (patch.currentName !== undefined) {
      eventType = "rename";
    }

    await logEvent({ documentId: params.id, type: eventType, before, after });

    return NextResponse.json({ document: updated });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/:id
 */
export async function DELETE(_req: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const existing = await getDocument(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    }

    await deleteFileToTrash(existing.filePath);
    await logEvent({ documentId: params.id, type: "delete", before: existing, after: null });
    await deleteDocument(params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
