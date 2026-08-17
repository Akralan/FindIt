/** Schéma SQLite local. Une seule table : le cache des documents synchronisés. */

export const SCHEMA_VERSION = 1;

export const CREATE_DOCUMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY NOT NULL,
  currentName TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL,
  documentDate TEXT,
  updatedAt TEXT NOT NULL,
  localFilePath TEXT NOT NULL,
  syncStatus TEXT NOT NULL
);
`;

export const CREATE_UPDATED_AT_INDEX = `
CREATE INDEX IF NOT EXISTS idx_documents_updatedAt ON documents (updatedAt);
`;

/**
 * Historique des recherches réellement tapées par l'utilisateur (jamais de
 * suggestions pré-remplies) — voir `src/db/searchHistory.ts`.
 */
export const CREATE_SEARCH_HISTORY_TABLE = `
CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  searchedAt TEXT NOT NULL
);
`;

export const CREATE_SEARCH_HISTORY_INDEX = `
CREATE INDEX IF NOT EXISTS idx_search_history_searchedAt ON search_history (searchedAt DESC);
`;
