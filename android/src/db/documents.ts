import type { LocalDocument, SyncStatus } from "@/types/document";

import { getDatabase } from "./database";

/** Ligne brute SQLite — `documentDate` peut être `null` (SQLite n'a pas `undefined`). */
interface DocumentRow {
  id: string;
  currentName: string;
  category: string;
  summary: string;
  mimeType: string;
  sizeBytes: number;
  documentDate: string | null;
  updatedAt: string;
  localFilePath: string;
  syncStatus: string;
}

function rowToDocument(row: DocumentRow): LocalDocument {
  return {
    id: row.id,
    currentName: row.currentName,
    category: row.category,
    summary: row.summary,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    documentDate: row.documentDate ?? undefined,
    updatedAt: row.updatedAt,
    localFilePath: row.localFilePath,
    syncStatus: row.syncStatus as SyncStatus,
  };
}

export async function listLocalDocuments(): Promise<LocalDocument[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<DocumentRow>("SELECT * FROM documents ORDER BY currentName COLLATE NOCASE ASC");
  return rows.map(rowToDocument);
}

export async function getLocalDocument(id: string): Promise<LocalDocument | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<DocumentRow>("SELECT * FROM documents WHERE id = ?", [id]);
  return row ? rowToDocument(row) : null;
}

/**
 * Renvoie l'`updatedAt` connu localement pour chaque id, sans charger le
 * reste des colonnes — c'est tout ce dont la comparaison avec le manifeste
 * distant (`sync/diff.ts`) a besoin.
 */
export async function getLocalUpdatedAtById(): Promise<Map<string, string>> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ id: string; updatedAt: string }>("SELECT id, updatedAt FROM documents");
  return new Map(rows.map((row) => [row.id, row.updatedAt]));
}

/** Insère ou remplace un document (upsert par `id`). */
export async function upsertLocalDocument(document: LocalDocument): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO documents (id, currentName, category, summary, mimeType, sizeBytes, documentDate, updatedAt, localFilePath, syncStatus)
     VALUES ($id, $currentName, $category, $summary, $mimeType, $sizeBytes, $documentDate, $updatedAt, $localFilePath, $syncStatus)
     ON CONFLICT(id) DO UPDATE SET
       currentName = excluded.currentName,
       category = excluded.category,
       summary = excluded.summary,
       mimeType = excluded.mimeType,
       sizeBytes = excluded.sizeBytes,
       documentDate = excluded.documentDate,
       updatedAt = excluded.updatedAt,
       localFilePath = excluded.localFilePath,
       syncStatus = excluded.syncStatus`,
    {
      $id: document.id,
      $currentName: document.currentName,
      $category: document.category,
      $summary: document.summary,
      $mimeType: document.mimeType,
      $sizeBytes: document.sizeBytes,
      $documentDate: document.documentDate ?? null,
      $updatedAt: document.updatedAt,
      $localFilePath: document.localFilePath,
      $syncStatus: document.syncStatus,
    },
  );
}

export async function deleteLocalDocument(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync("DELETE FROM documents WHERE id = ?", [id]);
}

/** Catégories distinctes présentes localement, triées, pour les filtres. */
export async function listLocalCategories(): Promise<string[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ category: string }>(
    "SELECT DISTINCT category FROM documents ORDER BY category COLLATE NOCASE ASC",
  );
  return rows.map((row) => row.category);
}
