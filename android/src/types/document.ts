/**
 * Types partagés, portés depuis `../../../src/lib/types.ts` (webapp PC) et
 * `../../../SYNC_CONTRACTS.md` (protocole de synchro). Ne pas faire diverger
 * les noms de champs : c'est le contrat qui permet au mobile et au PC
 * d'être développés indépendamment.
 */

/** Sous-ensemble de DocumentRecord (PC) exposé par GET /api/sync/manifest. */
export interface SyncManifestEntry {
  id: string;
  currentName: string;
  category: string;
  summary: string;
  mimeType: string;
  sizeBytes: number;
  documentDate?: string;
  updatedAt: string;
}

export type SyncStatus = "synced" | "local_only" | "pending_push";

/** Modèle local mobile (table SQLite `documents`) — schéma exact SYNC_CONTRACTS.md §4. */
export interface LocalDocument {
  /** = id PC une fois synchronisé, uuid local sinon. */
  id: string;
  currentName: string;
  category: string;
  summary: string;
  mimeType: string;
  sizeBytes: number;
  documentDate?: string;
  updatedAt: string;
  /** Chemin expo-file-system vers le fichier local. */
  localFilePath: string;
  syncStatus: SyncStatus;
}

export interface SearchResult {
  document: LocalDocument;
  score: number;
}

/** Payload JSON encodé dans le QR code de pairing (SYNC_CONTRACTS.md §1). */
export interface PairingInfo {
  host: string;
  port: number;
  token: string;
}
