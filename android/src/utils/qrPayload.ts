/**
 * Validation du payload JSON encodé dans le QR code de pairing
 * (SYNC_CONTRACTS.md §1) : `{ host, port, token }`. N'expose jamais le
 * contenu brut dans un message d'erreur ou un log (le token y figure).
 */

import type { PairingInfo } from "@/types/document";

export function parsePairingPayload(raw: string): PairingInfo | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;

  const { host, port, token } = candidate;
  if (typeof host !== "string" || host.length === 0) return null;
  if (typeof port !== "number" || !Number.isFinite(port) || port <= 0) return null;
  if (typeof token !== "string" || token.length === 0) return null;

  return { host, port, token };
}
