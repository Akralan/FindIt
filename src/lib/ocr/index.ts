/**
 * OCR local (Tesseract.js, WebAssembly — aucune dépendance native). Utilisé
 * par le provider `local` (`src/lib/providers/local.ts`) pour convertir une
 * image (photo de document, page de PDF scanné rendue en PNG) en texte
 * brut, faute de modèle vision local. Le reste de l'app ne connaît pas ce
 * module : seul le provider `local` l'appelle.
 *
 * Le worker Tesseract est réutilisé entre les appels (coûteux à créer) et
 * ses données de langue (fra + eng, ~qqs Mo) sont mises en cache sur disque
 * dans `data/models/tesseract/` après le tout premier téléchargement — donc
 * un seul appel réseau, jamais, une fois le cache chaud.
 */

import path from "path";
import { createWorker } from "tesseract.js";
import type { Worker } from "tesseract.js";

/** Longueur minimale de texte OCR en dessous de laquelle on considère le résultat inexploitable (image vide, bruit). */
export const OCR_TEXT_MIN_LENGTH = 10;

function resolveDataDir(): string {
  const dir = process.env.DATA_DIR ?? "./data";
  return path.resolve(process.cwd(), dir);
}

function resolveTesseractCacheDir(): string {
  return path.join(resolveDataDir(), "models", "tesseract");
}

let workerPromise: Promise<Worker> | null = null;

/** Crée (une seule fois) et retourne le worker Tesseract partagé. */
function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(["fra", "eng"], undefined, {
      cachePath: resolveTesseractCacheDir(),
    }).catch((error: unknown) => {
      // Un échec d'initialisation ne doit pas "coincer" le worker en échec
      // permanent : on autorise un nouvel essai au prochain appel.
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

/**
 * Reconnaît le texte d'une image. Toute erreur est relancée comme une
 * `Error` au message clair et actionnable en français.
 */
export async function recognizeText(buffer: Buffer): Promise<string> {
  let worker: Worker;
  try {
    worker = await getWorker();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "erreur inconnue";
    throw new Error(
      `Impossible d'initialiser l'OCR local (Tesseract) : ${detail}. Vérifiez la connexion réseau lors du tout premier lancement (téléchargement ponctuel des données de langue), puis réessayez.`
    );
  }

  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text.trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "erreur inconnue";
    throw new Error(`Échec de la reconnaissance de texte (OCR) sur cette image : ${detail}.`);
  }
}
