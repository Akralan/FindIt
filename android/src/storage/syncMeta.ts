/**
 * Horodatage de la dernière synchronisation réussie (téléchargement d'au
 * moins un document), affiché dans l'onglet Sync. `expo-secure-store` : même
 * mécanisme que le pairing (`src/storage/secureStore.ts`), pour une seule
 * valeur scalaire, pas besoin d'une table SQLite dédiée.
 */

import * as SecureStore from "expo-secure-store";

const KEY_LAST_SYNC_AT = "findit_last_sync_at";

export async function getLastSyncAt(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_LAST_SYNC_AT);
}

export async function setLastSyncAt(iso: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_LAST_SYNC_AT, iso);
}
