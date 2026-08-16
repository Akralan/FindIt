import { NextResponse } from "next/server";

import type { DocumentRecord, SyncManifestEntry } from "@/lib/types";
import { listDocuments } from "@/lib/db/documents";
import { requireSyncAuth } from "@/lib/sync/auth";

export const runtime = "nodejs";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

function toManifestEntry(doc: DocumentRecord): SyncManifestEntry {
  return {
    id: doc.id,
    currentName: doc.currentName,
    category: doc.category,
    summary: doc.summary,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    documentDate: doc.documentDate,
    updatedAt: doc.updatedAt,
  };
}

/**
 * GET /api/sync/manifest
 * Auth requise (voir SYNC_CONTRACTS.md). Retourne les documents confirmés
 * sous forme de SyncManifestEntry[], pour que le mobile compare avec son
 * cache local (par id + updatedAt) et détermine quoi télécharger.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const authError = await requireSyncAuth(req);
  if (authError) return authError;

  try {
    const documents = await listDocuments();
    const confirmed = documents.filter((doc) => doc.status === "confirmed");
    return NextResponse.json({ documents: confirmed.map(toManifestEntry) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
