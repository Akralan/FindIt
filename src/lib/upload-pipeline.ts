/**
 * Pipeline d'ingestion d'un fichier uploadé, commun à `POST /api/upload` et
 * `POST /api/sync/receive` : extraction IA, sauvegarde physique sous la
 * catégorie suggérée, création du `DocumentRecord` en `status:
 * "pending_review"`, journalisation de l'événement de création. Factorisé
 * ici pour que les deux routes ne dupliquent pas cette logique (voir
 * CONTRACTS.md et SYNC_CONTRACTS.md).
 */

import { v4 as uuidv4 } from "uuid";

import type { DocumentRecord } from "@/lib/types";
import { createDocument } from "@/lib/db/documents";
import { logEvent } from "@/lib/db/events";
import { saveFile } from "@/lib/storage/files";
import { extractDocument } from "@/lib/extraction";

export interface UploadFileInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

/**
 * Ingère un fichier unique : extraction IA, sauvegarde du fichier physique,
 * création + journalisation du document. Propage toute erreur (extraction
 * échouée, type non supporté...) à l'appelant, qui décide comment la
 * reporter.
 */
export async function ingestUploadedFile(file: UploadFileInput): Promise<DocumentRecord> {
  const { buffer, mimeType, fileName } = file;

  const extraction = await extractDocument({ buffer, mimeType, fileName });
  const filePath = await saveFile(buffer, extraction.suggestedCategory, extraction.suggestedName);

  const now = new Date().toISOString();
  const record: DocumentRecord = {
    id: uuidv4(),
    originalName: fileName,
    currentName: extraction.suggestedName,
    category: extraction.suggestedCategory,
    summary: extraction.summary,
    filePath,
    mimeType,
    sizeBytes: buffer.byteLength,
    documentDate: extraction.documentDate,
    status: "pending_review",
    createdAt: now,
    updatedAt: now,
  };

  const created = await createDocument(record);
  await logEvent({ documentId: created.id, type: "create", before: null, after: created });

  return created;
}
