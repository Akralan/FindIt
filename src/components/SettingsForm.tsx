"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ProviderConfigPublic, ProviderId } from "@/lib/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function SettingsForm() {
  const [config, setConfig] = useState<ProviderConfigPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [provider, setProvider] = useState<ProviderId>("mock");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [model, setModel] = useState("");

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
          setModel(publicConfig.openaiModel ?? "");
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const patch: Record<string, unknown> = { provider };
      if (apiKeyInput.trim().length > 0) patch.openaiApiKey = apiKeyInput.trim();
      if (model.trim().length > 0) patch.openaiModel = model.trim();

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
      setModel(publicConfig.openaiModel ?? "");
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

        <Input
          label="Modèle de génération"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="gpt-4o-mini"
          className="font-mono"
        />

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
