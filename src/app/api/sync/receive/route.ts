import { NextResponse } from "next/server";

import { ingestUploadedFile } from "@/lib/upload-pipeline";
import { requireSyncAuth } from "@/lib/sync/auth";

export const runtime = "nodejs";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * POST /api/sync/receive
 * Auth requise (voir SYNC_CONTRACTS.md). multipart/form-data, champ unique
 * "file" (un seul fichier par appel, contrairement à /api/upload). Réutilise
 * exactement le même pipeline que /api/upload via
 * `src/lib/upload-pipeline.ts` : extraction IA, sauvegarde, status
 * "pending_review". Prévu pour la v1.1 mobile (push) — pas encore appelé par
 * l'app mobile en v1 (pull seul).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const authError = await requireSyncAuth(req);
  if (authError) return authError;

  try {
    const formData = await req.formData();
    const entry = formData.get("file");

    if (!(entry instanceof File)) {
      return NextResponse.json(
        { error: "Aucun fichier fourni. Ajoutez un fichier au champ \"file\"." },
        { status: 400 }
      );
    }

    const arrayBuffer = await entry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = entry.type || "application/octet-stream";
    const fileName = entry.name || "document";

    const document = await ingestUploadedFile({ buffer, mimeType, fileName });

    return NextResponse.json({ document });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
