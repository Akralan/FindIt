import { useCallback, useEffect, useState } from "react";

import { addSearchHistoryEntry, listSearchHistory } from "@/db/searchHistory";

export interface UseSearchHistoryResult {
  recentQueries: string[];
  /** Enregistre une requête réellement tapée par l'utilisateur puis rafraîchit la liste. */
  recordQuery: (query: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSearchHistory(): UseSearchHistoryResult {
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const rows = await listSearchHistory();
    setRecentQueries(rows);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const recordQuery = useCallback(
    async (query: string) => {
      await addSearchHistoryEntry(query);
      await refresh();
    },
    [refresh],
  );

  return { recentQueries, recordQuery, refresh };
}
