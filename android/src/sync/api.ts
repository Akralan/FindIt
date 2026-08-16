/**
 * Client HTTP pour les routes `/api/sync/*` du PC (SYNC_CONTRACTS.md §2).
 * Réseau local uniquement, pas de retry silencieux, pas de token loggé.
 */

import type { PairingInfo, SyncManifestEntry } from "@/types/document";

export class SyncApiError extends Error {
  constructor(
    message: string,
    public readonly kind: "unauthorized" | "network" | "server",
  ) {
    super(message);
    this.name = "SyncApiError";
  }
}

function baseUrl(pairing: PairingInfo): string {
  return `http://${pairing.host}:${pairing.port}`;
}

/**
 * Délai avant abandon d'une requête réseau. Sans ça, `fetch` peut rester en
 * attente très longtemps (voire indéfiniment sur certains appareils) quand
 * le PC est injoignable — ex. pare-feu qui bloque le port en silence côté
 * PC — et l'écran de synchro reste bloqué sur "Connexion au PC…" sans
 * jamais afficher d'erreur.
 */
const REQUEST_TIMEOUT_MS = 8000;

async function fetchWithAuth(pairing: PairingInfo, path: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl(pairing)}${path}`, {
      headers: { Authorization: `Bearer ${pairing.token}` },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new SyncApiError(
        "Le PC ne répond pas (délai dépassé). Vérifie qu'un pare-feu ne bloque pas le port sur le PC, et que les deux appareils sont bien sur le même réseau Wi-Fi.",
        "network",
      );
    }
    throw new SyncApiError(
      "Impossible de joindre l'ordinateur. Vérifie que le PC et le téléphone sont sur le même réseau Wi-Fi et que l'application PC est ouverte.",
      "network",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401) {
    throw new SyncApiError(
      "Pairing refusé par le PC (jeton invalide ou régénéré). Re-scanne le QR code depuis les Réglages du PC.",
      "unauthorized",
    );
  }
  if (!response.ok) {
    throw new SyncApiError(`Le PC a répondu avec une erreur (HTTP ${response.status}).`, "server");
  }

  return response;
}

/** GET /api/sync/manifest — liste des documents confirmés côté PC. */
export async function fetchManifest(pairing: PairingInfo): Promise<SyncManifestEntry[]> {
  const response = await fetchWithAuth(pairing, "/api/sync/manifest");
  const body = (await response.json()) as { documents: SyncManifestEntry[] };
  return body.documents;
}

/** URL de téléchargement des octets bruts d'un document (avec auth séparée, voir fileStorage). */
export function documentFileUrl(pairing: PairingInfo, documentId: string): string {
  return `${baseUrl(pairing)}/api/sync/documents/${encodeURIComponent(documentId)}/file`;
}
