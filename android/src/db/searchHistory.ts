/**
 * Historique local des recherches réellement effectuées par l'utilisateur
 * (table SQLite `search_history`, voir `src/db/schema.ts`). Pas de fausses
 * suggestions pré-remplies : la liste est vide au premier lancement et ne
 * contient que des requêtes que l'utilisateur a lui-même tapées et validées.
 */

import { getDatabase } from "./database";

/** Nombre maximal de requêtes distinctes conservées. */
const MAX_ENTRIES = 8;

/**
 * Enregistre une recherche. Dédoublonne par texte de requête (insensible à
 * la casse) : une requête déjà présente est remontée en tête plutôt que
 * dupliquée. Purge le surplus au-delà de `MAX_ENTRIES`.
 */
export async function addSearchHistoryEntry(query: string): Promise<void> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return;

  const db = getDatabase();
  const now = new Date().toISOString();

  await db.runAsync("DELETE FROM search_history WHERE lower(query) = lower(?)", [trimmed]);
  await db.runAsync("INSERT INTO search_history (query, searchedAt) VALUES (?, ?)", [trimmed, now]);
  await db.runAsync(
    `DELETE FROM search_history WHERE id NOT IN (
       SELECT id FROM search_history ORDER BY searchedAt DESC LIMIT ?
     )`,
    [MAX_ENTRIES],
  );
}

/** Requêtes les plus récentes, les plus récentes en premier. */
export async function listSearchHistory(limit: number = MAX_ENTRIES): Promise<string[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ query: string }>(
    "SELECT query FROM search_history ORDER BY searchedAt DESC LIMIT ?",
    [limit],
  );
  return rows.map((row) => row.query);
}
