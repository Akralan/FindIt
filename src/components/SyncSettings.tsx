"use client";

import { useEffect, useState } from "react";
import type { SyncPairingInfo } from "@/lib/sync/pairing";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface FirewallStatus {
  exists: boolean;
  platform: string;
}

interface HotspotStatus {
  isActive: boolean | null;
  ssid: string | null;
  platform: string;
}

export function SyncSettings() {
  const [info, setInfo] = useState<SyncPairingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  const [firewall, setFirewall] = useState<FirewallStatus | null>(null);
  const [firewallLoading, setFirewallLoading] = useState(true);
  const [requestingFirewall, setRequestingFirewall] = useState(false);
  const [hotspot, setHotspot] = useState<HotspotStatus | null>(null);
  const [hotspotLoading, setHotspotLoading] = useState(true);
  const [startingHotspot, setStartingHotspot] = useState(false);
  const [stoppingHotspot, setStoppingHotspot] = useState(false);
  const [hotspotPairing, setHotspotPairing] = useState<SyncPairingInfo | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/sync/firewall");
        const data = await res.json();
        if (!cancelled && res.ok) setFirewall(data as FirewallStatus);
      } catch {
        // Silencieux : ce statut est indicatif, pas bloquant pour le reste de la page.
      } finally {
        if (!cancelled) setFirewallLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/sync/hotspot");
        const data = await res.json();
        if (!cancelled && res.ok) setHotspot(data as HotspotStatus);
      } catch {
        // Silencieux : ce statut est indicatif, pas bloquant pour le reste de la page.
      } finally {
        if (!cancelled) setHotspotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRequestFirewall() {
    setRequestingFirewall(true);
    try {
      const res = await fetch("/api/settings/sync/firewall", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Échec de l'ouverture du pare-feu.");
      setFirewall({ exists: true, platform: "win32" });
      showToast("Port ouvert dans le pare-feu Windows.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'ouverture du pare-feu.";
      showToast(message, "error");
    } finally {
      setRequestingFirewall(false);
    }
  }

  async function handleStartHotspot() {
    setStartingHotspot(true);
    try {
      const res = await fetch("/api/settings/sync/hotspot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Échec du démarrage du point d'accès.");
      const pairingInfo = data.pairingInfo as SyncPairingInfo;
      setHotspotPairing(pairingInfo);
      setHotspot({ isActive: true, ssid: pairingInfo.hotspot?.ssid ?? null, platform: "win32" });
      showToast("Point d'accès démarré.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec du démarrage du point d'accès.";
      showToast(message, "error");
    } finally {
      setStartingHotspot(false);
    }
  }

  async function handleStopHotspot() {
    setStoppingHotspot(true);
    try {
      const res = await fetch("/api/settings/sync/hotspot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Échec de l'arrêt du point d'accès.");
      setHotspot((prev) => (prev ? { ...prev, isActive: false, ssid: null } : prev));
      setHotspotPairing(null);
      showToast("Point d'accès arrêté.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'arrêt du point d'accès.";
      showToast(message, "error");
    } finally {
      setStoppingHotspot(false);
    }
  }

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

      {!firewallLoading && firewall?.platform === "win32" && (
        <div className="flex flex-col gap-2.5 border-t border-border-subtle pt-5">
          {firewall.exists ? (
            <p className="text-[13px] leading-5 text-text-muted">
              <span className="text-success">●</span> Le pare-feu Windows autorise déjà les connexions
              entrantes sur ce port.
            </p>
          ) : (
            <>
              <p className="text-[13px] leading-5 text-text-muted">
                Le pare-feu Windows bloque par défaut les connexions venant d&apos;autres appareils du
                réseau. Ce bouton ouvre le port de synchro — Windows affichera sa propre invite de
                confirmation, à accepter une seule fois.
              </p>
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={requestingFirewall}
                  onClick={handleRequestFirewall}
                >
                  Autoriser dans le pare-feu Windows
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {!hotspotLoading && hotspot?.platform === "win32" && (
        <div className="flex flex-col gap-3 border-t border-border-subtle pt-5">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[13px] font-medium text-text">
              Réseau isolé ? Utilisez le point d&apos;accès du PC
            </h3>
            <p className="text-[13px] leading-5 text-text-muted">
              Certains routeurs wifi isolent les appareils entre eux, ce qui empêche le téléphone de
              joindre ce PC en mode normal. Ce bouton transforme temporairement ce PC en son propre
              point d&apos;accès wifi, pour contourner cette limite sans toucher aux réglages du
              routeur.
            </p>
          </div>

          {hotspot.isActive ? (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] leading-5 text-text-muted">
                <span className="text-success">●</span> Point d&apos;accès actif
                {hotspot.ssid ? (
                  <>
                    {" — "}
                    <span className="font-mono">{hotspot.ssid}</span>
                  </>
                ) : null}
              </p>

              {hotspotPairing?.qrDataUrl ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hotspotPairing.qrDataUrl}
                    alt="Code de pairing via le point d'accès du PC"
                    width={200}
                    height={200}
                    className="h-[200px] w-[200px] rounded-card border border-border-subtle bg-white p-2"
                  />
                  <p className="font-mono text-xs text-text-faint">
                    {hotspotPairing.host}:{hotspotPairing.port}
                  </p>
                  {hotspotPairing.hotspot && (
                    <p className="text-center text-xs text-text-faint">
                      Mot de passe wifi : <span className="font-mono">{hotspotPairing.hotspot.password}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[13px] leading-5 text-text-muted">
                  Le code de connexion n&apos;est affiché qu&apos;au moment du démarrage. Arrêtez puis
                  redémarrez le point d&apos;accès depuis cette page pour l&apos;afficher à nouveau.
                </p>
              )}

              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={stoppingHotspot}
                  onClick={handleStopHotspot}
                >
                  Arrêter le point d&apos;accès
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button
                variant="secondary"
                size="sm"
                isLoading={startingHotspot}
                onClick={handleStartHotspot}
              >
                Démarrer le point d&apos;accès
              </Button>
            </div>
          )}
        </div>
      )}

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
