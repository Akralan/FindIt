"use client";

import { useEffect, useState } from "react";
import type { SyncPairingInfo } from "@/lib/sync/pairing";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function SyncSettings() {
  const [info, setInfo] = useState<SyncPairingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/sync");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Impossible de charger les informations de synchro.");
        if (!cancelled) setInfo(data as SyncPairingInfo);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Impossible de charger les informations de synchro.";
          showToast(message, "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch("/api/settings/sync/regenerate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Échec de la régénération du jeton.");
      setInfo(data as SyncPairingInfo);
      setConfirmingRegenerate(false);
      showToast(
        "Nouveau jeton généré. Les appareils déjà pairés devront rescanner le code.",
        "success"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de la régénération du jeton.";
      showToast(message, "error");
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5 rounded-card-lg border border-border bg-surface p-6">
        <div className="h-5 w-32 animate-pulse rounded-card bg-surface-hover" />
        <div className="mx-auto h-[200px] w-[200px] animate-pulse rounded-card bg-surface-hover" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[22px] rounded-card-lg border border-border bg-surface p-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[15px] font-medium text-text">Synchro mobile</h2>
        <p className="text-[13px] leading-5 text-text-muted">
          Scannez ce code depuis l&apos;appli mobile FindIt pour la connecter à cet ordinateur.
          L&apos;appareil qui scanne peut ensuite consulter vos documents (et, bientôt, en ajouter) tant
          que le jeton ci-dessous n&apos;a pas été régénéré.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        {info?.qrDataUrl ? (
          // Data URL générée côté serveur (lib "qrcode"), pas de dépendance externe au runtime.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.qrDataUrl}
            alt="Code de pairing pour la synchro mobile"
            width={200}
            height={200}
            className="h-[200px] w-[200px] rounded-card border border-border-subtle bg-white p-2"
          />
        ) : (
          <div className="flex h-[200px] w-[200px] items-center justify-center rounded-card border border-border-subtle bg-surface-hover px-4 text-center text-xs text-text-muted">
            Aucune adresse réseau locale détectée. Connectez ce poste à votre réseau local (Wi-Fi ou
            Ethernet) pour afficher le code.
          </div>
        )}
        {info?.host && (
          <p className="font-mono text-xs text-text-faint">
            {info.host}:{info.port}
          </p>
        )}
      </div>

      <div className="border-t border-border-subtle pt-5">
        {confirmingRegenerate ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">
              Régénérer le jeton invalide immédiatement le pairing de tout appareil déjà connecté : il
              faudra rescanner le code sur chacun d&apos;eux.
            </p>
            <div className="flex gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmingRegenerate(false)}
                disabled={regenerating}
              >
                Annuler
              </Button>
              <Button variant="danger-solid" size="sm" isLoading={regenerating} onClick={handleRegenerate}>
                Confirmer la régénération
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirmingRegenerate(true)}>
            Régénérer le jeton
          </Button>
        )}
      </div>
    </div>
  );
}
