import { NextResponse } from "next/server";

import type { DocumentRecord } from "@/lib/types";
import { ingestUploadedFile } from "@/lib/upload-pipeline";

export const runtime = "nodejs";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * POST /api/upload
 * multipart/form-data, champ répété "files". Pour chaque fichier : extraction
 * IA puis sauvegarde immédiate du fichier physique sous la catégorie
 * suggérée, avec status "pending_review". La confirmation définitive se fait
 * ensuite via PATCH /api/documents/:id.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const entries = formData.getAll("files");
    const files = entries.filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Aucun fichier fourni. Ajoutez au moins un fichier au champ \"files\"." },
        { status: 400 }
      );
    }

    const documents: DocumentRecord[] = [];
    const failures: string[] = [];

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = file.type || "application/octet-stream";
        const fileName = file.name || "document";

        const created = await ingestUploadedFile({ buffer, mimeType, fileName });
        documents.push(created);
      } catch (err) {
        failures.push(`${file.name || "fichier"} : ${errorMessage(err)}`);
      }
    }

    if (documents.length === 0) {
      return NextResponse.json(
        { error: failures[0] ?? "Échec de l'import des fichiers." },
        { status: 500 }
      );
    }

    return NextResponse.json({ documents });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
