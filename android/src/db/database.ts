import * as SQLite from "expo-sqlite";

import { CREATE_DOCUMENTS_TABLE, CREATE_UPDATED_AT_INDEX } from "./schema";

const DATABASE_NAME = "findit.db";

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Ouvre (ou réutilise) la base SQLite locale. Ne garantit pas à elle seule
 * que le schéma existe — appeler `initDatabase()` une fois au démarrage de
 * l'app (voir app/_layout.tsx) et l'attendre avant toute requête.
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(DATABASE_NAME);
  }
  return dbInstance;
}

let initPromise: Promise<void> | null = null;

/**
 * Crée le schéma s'il n'existe pas encore. Idempotent et mémoïsé : peut être
 * appelé plusieurs fois sans effet de bord, mais l'app ne doit lancer de
 * requêtes qu'après la résolution de la promesse retournée au premier appel.
 */
export function initDatabase(): Promise<void> {
  if (!initPromise) {
    const db = getDatabase();
    initPromise = db.execAsync(`
      PRAGMA journal_mode = WAL;
      ${CREATE_DOCUMENTS_TABLE}
      ${CREATE_UPDATED_AT_INDEX}
    `);
  }
  return initPromise;
}
