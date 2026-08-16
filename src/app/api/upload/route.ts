import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

import type { DocumentRecord } from "@/lib/types";
import { createDocument } from "@/lib/db/documents";
import { logEvent } from "@/lib/db/events";
import { saveFile } from "@/lib/storage/files";
import { extractDocument } from "@/lib/extraction";
import { getProvider } from "@/lib/providers";

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

        const extraction = await extractDocument({ buffer, mimeType, fileName });

        const filePath = await saveFile(buffer, extraction.suggestedCategory, extraction.suggestedName);

        const now = new Date().toISOString();
        const record: DocumentRecord = {
          id: uuidv4(),
          originalName: fileName,
          currentName: extraction.suggestedName,
          category: extraction.suggestedCategory,
          tags: extraction.suggestedTags,
          summary: extraction.summary,
          extractedText: extraction.text,
          filePath,
          mimeType,
          sizeBytes: buffer.byteLength,
          documentDate: extraction.documentDate,
          status: "pending_review",
          createdAt: now,
          updatedAt: now,
        };

        // L'embedding sert à la recherche sémantique : facultatif, ne doit
        // jamais faire échouer l'import si le provider est indisponible.
        try {
          const provider = await getProvider();
          const textForEmbedding = extraction.text || extraction.summary || fileName;
          record.embedding = await provider.embed(textForEmbedding);
        } catch {
          // On continue sans embedding : la recherche retombera sur le texte.
        }

        const created = await createDocument(record);
        await logEvent({ documentId: created.id, type: "create", before: null, after: created });

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
