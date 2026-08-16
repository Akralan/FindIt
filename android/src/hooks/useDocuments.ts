import { useCallback, useEffect, useState } from "react";

import { listLocalDocuments } from "@/db/documents";
import type { LocalDocument } from "@/types/document";

export interface UseDocumentsResult {
  documents: LocalDocument[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Charge la table `documents` locale en mémoire. Rafraîchissement explicite
 * (`refresh`) plutôt qu'une souscription live — cohérent avec le principe
 * "synchro manuelle uniquement" (pas de tâche de fond qui réécrit la table
 * pendant que l'écran est ouvert).
 */
export function useDocuments(): UseDocumentsResult {
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await listLocalDocuments();
      setDocuments(rows);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { documents, isLoading, refresh };
}
