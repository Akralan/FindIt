import { NextResponse } from "next/server";

import { getDocument } from "@/lib/db/documents";
import { readFile } from "@/lib/storage/files";
import { requireSyncAuth } from "@/lib/sync/auth";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

/** Échappe les guillemets pour le paramètre `filename` de Content-Disposition. */
function safeFileName(fileName: string): string {
  return fileName.replace(/["\\]/g, "_");
}

/**
 * GET /api/sync/documents/:id/file
 * Auth requise (voir SYNC_CONTRACTS.md). Sert les octets bruts du fichier,
 * distinct de POST /api/documents/:id/reveal qui ouvre l'Explorateur côté
 * PC — celui-ci sert vraiment le contenu par HTTP pour le mobile.
 */
export async function GET(req: Request, { params }: RouteContext): Promise<NextResponse> {
  const authError = await requireSyncAuth(req);
  if (authError) return authError;

  try {
    const document = await getDocument(params.id);
    if (!document) {
      return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    }

    const buffer = await readFile(document.filePath);
    const fileName = safeFileName(document.currentName);
    const encodedFileName = encodeURIComponent(document.currentName);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`,
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
