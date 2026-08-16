import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { clearPairing, loadPairing, savePairing } from "@/storage/secureStore";
import type { PairingInfo } from "@/types/document";

export interface UsePairingResult {
  pairing: PairingInfo | null;
  /** `null` tant que la lecture de expo-secure-store n'est pas terminée. */
  isLoading: boolean;
  setPairing: (pairing: PairingInfo) => Promise<void>;
  forgetPairing: () => Promise<void>;
}

/**
 * `usePairing` n'a pas d'état partagé entre écrans (pas de Context/store
 * global) : chaque écran qui l'appelle a son propre `useState`, rempli en
 * lisant expo-secure-store. Avec la navigation en pile d'Expo Router, un
 * écran resté monté en arrière-plan (ex. Réglages, sous l'écran Scan) ne
 * revoit jamais ce `useState` se mettre à jour tout seul quand un AUTRE
 * écran modifie le pairing — d'où le rechargement explicite à chaque
 * reprise de focus (`useFocusEffect`), pas seulement au montage.
 */
export function usePairing(): UsePairingResult {
  const [pairing, setPairingState] = useState<PairingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    let cancelled = false;
    loadPairing()
      .then((loaded) => {
        if (!cancelled) setPairingState(loaded);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  useFocusEffect(
    useCallback(() => {
      const cancel = load();
      return cancel;
    }, [load]),
  );

  const setPairing = useCallback(async (next: PairingInfo) => {
    await savePairing(next);
    setPairingState(next);
  }, []);

  const forgetPairing = useCallback(async () => {
    await clearPairing();
    setPairingState(null);
  }, []);

  return { pairing, isLoading, setPairing, forgetPairing };
}
