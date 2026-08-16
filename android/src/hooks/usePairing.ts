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

export function usePairing(): UsePairingResult {
  const [pairing, setPairingState] = useState<PairingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
