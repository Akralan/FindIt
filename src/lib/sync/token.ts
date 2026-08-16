/**
 * Jeton de pairing pour la synchro PC ↔ Mobile (voir SYNC_CONTRACTS.md).
 * Stocké dans le même fichier que la config provider (`data/config.local.json`,
 * champ `syncToken`), mais géré indépendamment de `src/lib/config.ts` : ce
 * n'est pas un réglage de provider IA, et il ne doit jamais transiter par
 * `getPublicConfig()`/`updateConfig()`.
 *
 * Jamais loggé, jamais renvoyé ailleurs que par les routes de pairing
 * elles-mêmes.
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { resolveDataDir } from "@/lib/storage/files";

const CONFIG_FILE_NAME = "config.local.json";
/** Longueur en octets du jeton généré (64 caractères hexadécimaux). */
const TOKEN_BYTES = 32;

function resolveConfigFilePath(): string {
  return path.join(resolveDataDir(), CONFIG_FILE_NAME);
}

/** Lit le fichier de config brut, sans filtrer les champs (contrairement à
 * `src/lib/config.ts` qui ne connaît que les champs de `ProviderConfig`). */
async function readRawConfig(): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(resolveConfigFilePath(), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Écrit `syncToken` dans le fichier de config, en préservant les autres
 * champs déjà présents (provider, openaiApiKey, openaiModel...). */
async function persistSyncToken(token: string): Promise<void> {
  const dataDir = resolveDataDir();
  await fs.mkdir(dataDir, { recursive: true });
  const current = await readRawConfig();
  const next = { ...current, syncToken: token };
  await fs.writeFile(resolveConfigFilePath(), JSON.stringify(next, null, 2), "utf-8");
}

function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * Retourne le jeton de pairing courant, en le générant et le persistant s'il
 * n'existe pas encore (première visite de la section Synchro des Réglages,
 * ou première requête vers une route /api/sync/*).
 */
export async function getSyncToken(): Promise<string> {
  const current = await readRawConfig();
  const existing = current.syncToken;
  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }
  const token = generateToken();
  await persistSyncToken(token);
  return token;
}

/**
 * Génère un nouveau jeton et invalide l'ancien (tout appareil déjà pairé
 * devra re-scanner le QR code).
 */
export async function regenerateSyncToken(): Promise<string> {
  const token = generateToken();
  await persistSyncToken(token);
  return token;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Vérifie un jeton fourni par un client contre le jeton courant. */
export async function isValidSyncToken(candidate: string | null): Promise<boolean> {
  if (!candidate) return false;
  const current = await getSyncToken();
  return timingSafeEqualStrings(candidate, current);
}
