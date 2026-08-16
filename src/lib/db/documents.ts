/**
 * Accès aux documents stockés dans data/db.json.
 */

import type { DocumentRecord, DocumentSummary } from "@/lib/types";
import { readDb, writeDb } from "./store";

/** Retire le texte intégral et l'embedding d'un DocumentRecord. */
function toSummary(doc: DocumentRecord): DocumentSummary {
  const { extractedText, embedding, ...summary } = doc;
  return summary;
}

/** Liste les documents, éventuellement filtrés par catégorie. */
export async function listDocuments(opts?: {
  category?: string;
}): Promise<DocumentSummary[]> {
  const db = await readDb();
  const filtered = opts?.category
    ? db.documents.filter((doc) => doc.category === opts.category)
    : db.documents;
  return filtered.map(toSummary);
}

/** Récupère un document complet par id, ou null s'il n'existe pas. */
export async function getDocument(id: string): Promise<DocumentRecord | null> {
  const db = await readDb();
  return db.documents.find((doc) => doc.id === id) ?? null;
}

/** Ajoute un nouveau document à la base. */
export async function createDocument(
  rec: DocumentRecord
): Promise<DocumentRecord> {
  const db = await readDb();
  db.documents.push(rec);
  await writeDb(db);
  return rec;
}

/**
 * Applique `patch` au document `id`, met à jour `updatedAt`, et retourne le
 * document mis à jour. Lève une erreur si le document n'existe pas.
 */
export async function updateDocument(
  id: string,
  patch: Partial<DocumentRecord>
): Promise<DocumentRecord> {
  const db = await readDb();
  const index = db.documents.findIndex((doc) => doc.id === id);
  if (index === -1) {
    throw new Error(`Document introuvable : ${id}`);
  }
  const updated: DocumentRecord = {
    ...db.documents[index],
    ...patch,
    id: db.documents[index].id,
    updatedAt: new Date().toISOString(),
  };
  db.documents[index] = updated;
  await writeDb(db);
  return updated;
}

/** Supprime un document de la base (le fichier physique n'est pas touché ici). */
export async function deleteDocument(id: string): Promise<void> {
  const db = await readDb();
  db.documents = db.documents.filter((doc) => doc.id !== id);
  await writeDb(db);
}

/** Liste les catégories existantes avec le nombre de documents dans chacune. */
export async function listCategories(): Promise<
  { category: string; count: number }[]
> {
  const db = await readDb();
  const counts = new Map<string, number>();
  for (const doc of db.documents) {
    counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
