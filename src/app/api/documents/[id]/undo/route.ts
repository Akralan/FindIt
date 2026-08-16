import { NextResponse } from "next/server";

import type { DocumentRecord } from "@/lib/types";
import { createDocument, deleteDocument, getDocument, updateDocument } from "@/lib/db/documents";
import { deleteEvent, getLastEvent } from "@/lib/db/events";
import { deleteFileToTrash, moveFile } from "@/lib/storage/files";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * POST /api/documents/:id/undo
 * Annule le dernier event enregistré pour ce document en restaurant l'état
 * "before" de cet event.
 */
export async function POST(_req: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const documentId = params.id;
    const lastEvent = await getLastEvent(documentId);

    if (!lastEvent) {
      return NextResponse.json(
        { error: "Aucune action à annuler pour ce document." },
        { status: 404 }
      );
    }

    // Event "create" sans état "before" : annuler revient à supprimer le
    // document créé (retour à l'état antérieur, où il n'existait pas).
    if (lastEvent.before === null) {
      const existing = await getDocument(documentId);
      if (!existing) {
        return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
      }

      await deleteFileToTrash(existing.filePath);
      await deleteDocument(documentId);
      await deleteEvent(lastEvent.id);

      return NextResponse.json({ document: existing });
    }

    // Event "delete" : le document n'existe plus en base, on le recrée à
    // partir de l'état sauvegardé avant suppression.
    if (lastEvent.type === "delete") {
      const restored = await createDocument(lastEvent.before as DocumentRecord);
      await deleteEvent(lastEvent.id);
      return NextResponse.json({ document: restored });
    }

    // Autres events (rename/move/edit) : on réapplique les anciennes valeurs.
    const existing = await getDocument(documentId);
    if (!existing) {
      return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    }

    const before = lastEvent.before;
    const patch: Partial<DocumentRecord> = { ...before };

    const nameOrCategoryChanged = before.currentName !== undefined || before.category !== undefined;
    if (nameOrCategoryChanged) {
      const targetCategory = before.category ?? existing.category;
      const targetName = before.currentName ?? existing.currentName;
      const newFilePath = await moveFile(existing.filePath, targetCategory, targetName);
      patch.filePath = newFilePath;
    }

    patch.updatedAt = new Date().toISOString();
    const updated = await updateDocument(documentId, patch);
    await deleteEvent(lastEvent.id);

    return NextResponse.json({ document: updated });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
