/**
 * Comparaison manifeste distant (PC) vs cache local (SQLite), par `id` +
 * `updatedAt` — SYNC_CONTRACTS.md §2. Ne propose que ce qui est nouveau ou
 * modifié depuis la dernière synchro ; jamais un miroir automatique complet
 * (ROADMAP.md, principe « sélective des deux côtés »).
 */

import type { SyncManifestEntry } from "@/types/document";

export type DiffKind = "new" | "modified";

export interface SyncDiffEntry {
  entry: SyncManifestEntry;
  kind: DiffKind;
}

export function computeSyncDiff(
  manifest: SyncManifestEntry[],
  localUpdatedAtById: Map<string, string>,
): SyncDiffEntry[] {
  const diff: SyncDiffEntry[] = [];

  for (const entry of manifest) {
    const localUpdatedAt = localUpdatedAtById.get(entry.id);
    if (localUpdatedAt === undefined) {
      diff.push({ entry, kind: "new" });
    } else if (localUpdatedAt !== entry.updatedAt) {
      diff.push({ entry, kind: "modified" });
    }
    // Sinon : identique localement, rien à proposer.
  }

  return diff;
}
