"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { LocalModelStatus, ProviderConfigPublic, ProviderId } from "@/lib/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const LOCAL_STATUS_POLL_INTERVAL_MS = 800;

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} Mo`;
}

export function SettingsForm() {
  const [config, setConfig] = useState<ProviderConfigPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [provider, setProvider] = useState<ProviderId>("mock");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");

  const [localStatus, setLocalStatus] = useState<LocalModelStatus | null>(null);
  const [localStatusLoading, setLocalStatusLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Impossible de charger les réglages.");
        const publicConfig = data.config as ProviderConfigPublic;
        if (!cancelled) {
          setConfig(publicConfig);
          setProvider(publicConfig.provider);
          setOpenaiModel(publicConfig.openaiModel ?? "");
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Impossible de charger les réglages.";
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

  async function fetchLocalStatus(): Promise<LocalModelStatus | null> {
    try {
      const res = await fetch("/api/models/local/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Impossible de lire le statut du modèle local.");
      return data.status as LocalModelStatus;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de lire le statut du modèle local.";
      showToast(message, "error");
      return null;
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const status = await fetchLocalStatus();
      if (status) {
        setLocalStatus(status);
        if (status.state !== "downloading") stopPolling();
      }
    }, LOCAL_STATUS_POLL_INTERVAL_MS);
  }

  // Charge le statut du modèle local dès que "Local" est sélectionné, et
  // reprend le polling si un téléchargement était déjà en cours.
  useEffect(() => {
    if (provider !== "local") {
      stopPolling();
      return;
    }
    let cancelled = false;
    (async () => {
      const status = await fetchLocalStatus();
      if (!cancelled && status) {
        setLocalStatus(status);
        if (status.state === "downloading") startPolling();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  useEffect(() => stopPolling, []);

  async function handleDownloadModel() {
    setLocalStatusLoading(true);
    try {
      const res = await fetch("/api/models/local/download", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Échec du démarrage du téléchargement.");
      setLocalStatus(data.status as LocalModelStatus);
      startPolling();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec du démarrage du téléchargement.";
      showToast(message, "error");
    } finally {
      setLocalStatusLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const patch: Record<string, unknown> = { provider };
      if (apiKeyInput.trim().length > 0) patch.openaiApiKey = apiKeyInput.trim();
      if (openaiModel.trim().length > 0) patch.openaiModel = openaiModel.trim();

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Échec de l'enregistrement des réglages.");

      const publicConfig = data.config as ProviderConfigPublic;
      setConfig(publicConfig);
      setProvider(publicConfig.provider);
      setOpenaiModel(publicConfig.openaiModel ?? "");
      setApiKeyInput("");
      showToast("Réglages enregistrés.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'enregistrement des réglages.";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5 rounded-card-lg border border-border bg-surface p-6">
        <div className="h-11 w-full animate-pulse rounded-card bg-surface-hover" />
        <div className="h-11 w-full animate-pulse rounded-card bg-surface-hover" />
        <div className="h-11 w-full animate-pulse rounded-card bg-surface-hover" />
      </div>
    );
  }

  const selectedProviderMeta = config?.availableProviders.find((p) => p.id === provider);
  const requiresApiKey = selectedProviderMeta?.requiresApiKey ?? false;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-7">
      <div className="flex flex-col gap-[22px] rounded-card-lg border border-border bg-surface p-6">
        <div className="flex flex-col gap-[7px]">
          <label htmlFor="provider" className="text-[13px] font-medium text-text">
            Provider IA
          </label>
          <select
            id="provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value as ProviderId)}
            className="h-[42px] rounded-card border border-border bg-surface px-3 text-sm text-text"
          >
            {(config?.availableProviders ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-faint">
            Vos documents ne sont envoyés qu&apos;au provider que vous configurez.
          </p>
        </div>

        {requiresApiKey && (
          <Input
            type="password"
            label="Clé API"
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
            placeholder={config?.hasApiKey ? "•••••••••••••••• (déjà enregistrée)" : "sk-..."}
            hint={
              config?.hasApiKey
                ? "Laissez vide pour conserver la clé enregistrée."
                : "Nécessaire pour utiliser ce provider."
            }
            autoComplete="off"
          />
        )}

        {provider === "openai" && (
          <Input
            label="Modèle de génération"
            value={openaiModel}
            onChange={(event) => setOpenaiModel(event.target.value)}
            placeholder="gpt-4o-mini"
            className="font-mono"
          />
        )}

        {provider === "local" && (
          <div className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-hover/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-text">{localStatus?.label ?? "Modèle local"}</span>
                <span className="text-xs text-text-faint">
                  Tourne entièrement sur cette machine, aucune clé requise — environ{" "}
                  {formatMegabytes(localStatus?.approxSizeBytes ?? 0)}.
                </span>
              </div>
              {localStatus?.state === "ready" && (
                <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">Prêt</span>
              )}
            </div>

            {(localStatus?.state === "not_downloaded" || localStatus?.state === "error") && (
              <div className="flex flex-col gap-2">
                {localStatus.state === "error" && (
                  <p className="text-xs text-danger">{localStatus.error}</p>
                )}
                <Button type="button" variant="secondary" isLoading={localStatusLoading} onClick={handleDownloadModel}>
                  {localStatus.state === "error" ? "Réessayer le téléchargement" : "Télécharger le modèle"}
                </Button>
              </div>
            )}

            {localStatus?.state === "downloading" && (
              <div className="flex flex-col gap-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full bg-accent transition-[width]"
                    style={{
                      width: `${
                        localStatus.totalBytes && localStatus.totalBytes > 0
                          ? Math.min(100, ((localStatus.downloadedBytes ?? 0) / localStatus.totalBytes) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-xs text-text-faint">
                  Téléchargement… {formatMegabytes(localStatus.downloadedBytes ?? 0)} /{" "}
                  {formatMegabytes(localStatus.totalBytes ?? localStatus.approxSizeBytes)}
                </span>
              </div>
            )}

            <p className="text-xs text-text-faint">
              Les images/scans passent par un OCR local (Tesseract) avant analyse — pas de modèle de vision.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-border-subtle pt-5">
          <Button type="submit" isLoading={saving}>
            Enregistrer
          </Button>
        </div>
      </div>

      <div className="flex gap-3.5 rounded-[14px] border border-border-subtle bg-surface-hover/60 px-[18px] py-4">
        <span className="mt-1.5 inline-block h-[7px] w-[7px] flex-none rounded-full bg-accent" />
        <p className="text-[13px] leading-5 text-text-muted">
          Vos fichiers restent sur votre machine, dans{" "}
          <span className="font-mono text-xs text-text">data/files/&lt;catégorie&gt;/</span> — FindIt ne
          conserve rien ailleurs.
        </p>
      </div>
    </form>
  );
}
