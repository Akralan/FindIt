/**
 * Configuration du provider IA. Ordre de priorité (du plus fort au plus
 * faible) : data/config.local.json (édité via la page Réglages) > variables
 * d'environnement (.env.local) > valeurs par défaut codées en dur.
 *
 * La clé API n'est jamais loguée, ni renvoyée en clair par getPublicConfig().
 */

import { promises as fs } from "fs";
import path from "path";
import type { ProviderConfig, ProviderConfigPublic } from "@/lib/types";
import { listProviders } from "@/lib/providers";

const CONFIG_FILE_NAME = "config.local.json";

/** Défauts codés en dur, utilisés si ni le fichier local ni l'env ne fournissent de valeur. */
const HARD_DEFAULTS: ProviderConfig = {
  provider: "mock",
  openaiModel: "gpt-4o-mini",
};

function resolveDataDir(): string {
  const dir = process.env.DATA_DIR ?? "./data";
  return path.resolve(process.cwd(), dir);
}

function resolveConfigFilePath(): string {
  return path.join(resolveDataDir(), CONFIG_FILE_NAME);
}

function isProviderId(value: string): value is ProviderConfig["provider"] {
  return value === "openai" || value === "mock";
}

/** Lit data/config.local.json. Retourne {} si absent ou illisible/corrompu. */
async function readLocalConfig(): Promise<Partial<ProviderConfig>> {
  try {
    const raw = await fs.readFile(resolveConfigFilePath(), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return parsed as Partial<ProviderConfig>;
  } catch {
    return {};
  }
}

function readEnvConfig(): Partial<ProviderConfig> {
  const config: Partial<ProviderConfig> = {};

  const provider = process.env.AI_PROVIDER;
  if (provider && isProviderId(provider)) {
    config.provider = provider;
  }

  if (process.env.OPENAI_API_KEY) {
    config.openaiApiKey = process.env.OPENAI_API_KEY;
  }
  if (process.env.OPENAI_MODEL) {
    config.openaiModel = process.env.OPENAI_MODEL;
  }

  return config;
}

/** Fusionne défauts < env < config locale, en ignorant les valeurs vides/undefined. */
function mergeConfigs(
  ...layers: Array<Partial<ProviderConfig>>
): ProviderConfig {
  const merged: Partial<ProviderConfig> = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined && value !== null && value !== "") {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }
  return {
    provider: merged.provider ?? HARD_DEFAULTS.provider,
    openaiApiKey: merged.openaiApiKey,
    openaiModel: merged.openaiModel ?? HARD_DEFAULTS.openaiModel,
  };
}

export async function getConfig(): Promise<ProviderConfig> {
  const envConfig = readEnvConfig();
  const localConfig = await readLocalConfig();
  return mergeConfigs(HARD_DEFAULTS, envConfig, localConfig);
}

export async function updateConfig(
  patch: Partial<ProviderConfig>
): Promise<void> {
  const dataDir = resolveDataDir();
  await fs.mkdir(dataDir, { recursive: true });

  const current = await readLocalConfig();
  const next: Partial<ProviderConfig> = { ...current };

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      (next as Record<string, unknown>)[key] = value;
    }
  }

  await fs.writeFile(
    resolveConfigFilePath(),
    JSON.stringify(next, null, 2),
    "utf-8"
  );
}

export async function getPublicConfig(): Promise<ProviderConfigPublic> {
  const config = await getConfig();
  return {
    provider: config.provider,
    openaiModel: config.openaiModel,
    hasApiKey: Boolean(config.openaiApiKey && config.openaiApiKey.length > 0),
    availableProviders: listProviders(),
  };
}
