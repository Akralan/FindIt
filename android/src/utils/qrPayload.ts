/**
 * Validation du payload JSON encodé dans le QR code de pairing
 * (SYNC_CONTRACTS.md §1) : `{ host, port, token }`, avec un champ optionnel
 * `hotspot: { ssid, password }` (SYNC_CONTRACTS.md §1bis, mode hotspot) le
 * jour où le PC a démarré son propre point d'accès plutôt que d'utiliser le
 * wifi partagé. Rétro-compatible avec l'ancien format (sans `hotspot`) —
 * champ optionnel, pas un nouveau format de QR. N'expose jamais le contenu
 * brut dans un message d'erreur ou un log (le token — et désormais le mot de
 * passe du hotspot — y figurent).
 */

import type { HotspotInfo, PairingInfo } from "@/types/document";

function parseHotspot(candidate: unknown): HotspotInfo | null | undefined {
  // Champ absent : cas normal, pas un hotspot.
  if (candidate === undefined) return undefined;
  // Champ présent mais mal formé : QR invalide dans son ensemble plutôt que
  // de l'ignorer silencieusement (mieux vaut rejeter que pairer sans le
  // contexte hotspot attendu par l'utilisateur).
  if (typeof candidate !== "object" || candidate === null) return null;

  const { ssid, password } = candidate as Record<string, unknown>;
  if (typeof ssid !== "string" || ssid.length === 0) return null;
  if (typeof password !== "string" || password.length === 0) return null;

  return { ssid, password };
}

export function parsePairingPayload(raw: string): PairingInfo | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;

  const { host, port, token, hotspot } = candidate;
  if (typeof host !== "string" || host.length === 0) return null;
  if (typeof port !== "number" || !Number.isFinite(port) || port <= 0) return null;
  if (typeof token !== "string" || token.length === 0) return null;

  const parsedHotspot = parseHotspot(hotspot);
  if (parsedHotspot === null) return null;

  return parsedHotspot === undefined ? { host, port, token } : { host, port, token, hotspot: parsedHotspot };
}
