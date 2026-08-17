/**
 * Gestion du cycle de vie du modèle local (téléchargement, cache disque,
 * statut). Statut persisté sur disque (`data/models/.download-status.json`,
 * `.model-info.json`) plutôt qu'en mémoire : les routes API Next.js
 * (`GET .../status`, `POST .../download`) peuvent chacune s'exécuter dans
 * une instance de module distincte, donc une variable de module partagée
 * entre les deux n'est PAS fiable — seul le disque l'est (même principe que
 * `data/db.json` ailleurs dans l'app). `node-llama-cpp` n'est importé
 * dynamiquement qu'au moment réel du téléchargement, pour ne jamais charger
 * ses bindings natifs tant que le provider `local` n'est pas utilisé.
 *
 * Exposé à l'app via deux fonctions : `getLocalModelStatus()` (lecture,
 * utilisée par la route de statut) et `startLocalModelDownload()`
 * (déclenchement, idempotent — un appel pendant un téléchargement en cours
 * renvoie juste sa progression actuelle, y compris si ce téléchargement a
 * été démarré par une autre instance de route).
 */

import { promises as fs } from "fs";
import path from "path";
import type { LocalModelStatus } from "@/lib/types";
import { ACTIVE_LOCAL_MODEL } from "@/lib/models/registry";

/** Au-delà de cette fraîcheur, un statut "downloading" persisté est considéré abandonné (process tué en plein téléchargement). */
const STALE_DOWNLOAD_MS = 15_000;

function resolveDataDir(): string {
  const dir = process.env.DATA_DIR ?? "./data";
  return path.resolve(process.cwd(), dir);
}

function resolveModelsDir(): string {
  return path.join(resolveDataDir(), "models");
}

function downloadStatusFilePath(): string {
  return path.join(resolveModelsDir(), ".download-status.json");
}

function modelInfoFilePath(): string {
  return path.join(resolveModelsDir(), ".model-info.json");
}

interface PersistedDownloadStatus {
  state: "downloading" | "error";
  downloadedBytes?: number;
  totalBytes?: number;
  error?: string;
  /** `Date.now()` — sert à détecter un statut abandonné (process tué). */
  updatedAt: number;
}

interface PersistedModelInfo {
  /** Chemin absolu résolu par node-llama-cpp (`ModelDownloader.entrypointFilePath`) — jamais deviné. */
  modelPath: string;
  /** `ACTIVE_LOCAL_MODEL.id` au moment du téléchargement — invalide le cache si le registre change de modèle. */
  modelId: string;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  try {
    await fs.mkdir(resolveModelsDir(), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value), "utf-8");
  } catch {
    // Best-effort : un échec d'écriture du statut ne doit jamais faire
    // planter le téléchargement lui-même — au pire, le polling se rattrape
    // à l'écriture suivante.
  }
}

async function clearDownloadStatusFile(): Promise<void> {
  try {
    await fs.unlink(downloadStatusFilePath());
  } catch {
    // déjà absent, rien à faire
  }
}

/**
 * Retourne le chemin du fichier modèle si prêt et toujours présent sur
 * disque, sinon `null`. Ne déclenche jamais de téléchargement, ne devine
 * jamais de nom de fichier : lit le chemin exact résolu lors du
 * téléchargement précédent.
 */
export async function getReadyLocalModelPath(): Promise<string | null> {
  const info = await readJsonFile<PersistedModelInfo>(modelInfoFilePath());
  if (!info || info.modelId !== ACTIVE_LOCAL_MODEL.id) return null;

  try {
    const stat = await fs.stat(info.modelPath);
    if (stat.isFile() && stat.size > 0) return info.modelPath;
  } catch {
    // Fichier supprimé manuellement entre-temps.
  }
  return null;
}

function baseStatus() {
  return { label: ACTIVE_LOCAL_MODEL.label, approxSizeBytes: ACTIVE_LOCAL_MODEL.approxSizeBytes };
}

/** Statut courant, pour affichage/polling (route `GET /api/models/local/status`). */
export async function getLocalModelStatus(): Promise<LocalModelStatus> {
  const readyPath = await getReadyLocalModelPath();
  if (readyPath) return { ...baseStatus(), state: "ready" };

  const persisted = await readJsonFile<PersistedDownloadStatus>(downloadStatusFilePath());
  if (persisted) {
    const isFresh = Date.now() - persisted.updatedAt < STALE_DOWNLOAD_MS;
    if (persisted.state === "downloading" && isFresh) {
      return {
        ...baseStatus(),
        state: "downloading",
        downloadedBytes: persisted.downloadedBytes,
        totalBytes: persisted.totalBytes,
      };
    }
    if (persisted.state === "error") {
      return { ...baseStatus(), state: "error", error: persisted.error };
    }
    // "downloading" mais périmé (process tué en cours de route) : on
    // retombe sur "not_downloaded" ci-dessous, un nouvel essai est possible.
  }

  return { ...baseStatus(), state: "not_downloaded" };
}

let downloadInFlight: Promise<void> | null = null;

async function runDownload(): Promise<void> {
  await writeJsonFile(downloadStatusFilePath(), {
    state: "downloading",
    downloadedBytes: 0,
    totalBytes: ACTIVE_LOCAL_MODEL.approxSizeBytes,
    updatedAt: Date.now(),
  } satisfies PersistedDownloadStatus);

  try {
    await fs.mkdir(resolveModelsDir(), { recursive: true });
    const { createModelDownloader } = await import("node-llama-cpp");

    let lastWriteAt = 0;
    const downloader = await createModelDownloader({
      modelUri: ACTIVE_LOCAL_MODEL.uri,
      dirPath: resolveModelsDir(),
      onProgress: ({ totalSize, downloadedSize }) => {
        const now = Date.now();
        if (now - lastWriteAt < 200) return; // throttle l'écriture disque
        lastWriteAt = now;
        void writeJsonFile(downloadStatusFilePath(), {
          state: "downloading",
          downloadedBytes: downloadedSize,
          totalBytes: totalSize > 0 ? totalSize : ACTIVE_LOCAL_MODEL.approxSizeBytes,
          updatedAt: now,
        } satisfies PersistedDownloadStatus);
      },
    });

    const modelPath = await downloader.download();
    await writeJsonFile(modelInfoFilePath(), {
      modelPath,
      modelId: ACTIVE_LOCAL_MODEL.id,
    } satisfies PersistedModelInfo);
    await clearDownloadStatusFile();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "erreur inconnue";
    await writeJsonFile(downloadStatusFilePath(), {
      state: "error",
      error: `Échec du téléchargement du modèle local (${ACTIVE_LOCAL_MODEL.label}) : ${detail}`,
      updatedAt: Date.now(),
    } satisfies PersistedDownloadStatus);
  }
}

/**
 * Déclenche le téléchargement s'il n'est pas déjà prêt ou en cours (y
 * compris en cours dans une autre instance de route — vérifié via le
 * fichier de statut, pas seulement en mémoire). Idempotent : appelable
 * plusieurs fois sans effet de bord, renvoie toujours le statut courant.
 */
export async function startLocalModelDownload(): Promise<LocalModelStatus> {
  const readyPath = await getReadyLocalModelPath();
  if (readyPath) return { ...baseStatus(), state: "ready" };

  const persisted = await readJsonFile<PersistedDownloadStatus>(downloadStatusFilePath());
  const alreadyRunningElsewhere =
    persisted?.state === "downloading" && Date.now() - persisted.updatedAt < STALE_DOWNLOAD_MS;

  if (!downloadInFlight && !alreadyRunningElsewhere) {
    downloadInFlight = runDownload().finally(() => {
      downloadInFlight = null;
    });
  }

  return getLocalModelStatus();
}
