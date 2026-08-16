/**
 * Détection de l'IP locale et du port du serveur, utilisés pour construire
 * le contenu du QR code de pairing (voir SYNC_CONTRACTS.md).
 */

import os from "os";

const DEFAULT_PORT = 3000;

/**
 * Retourne la première adresse IPv4 non-interne du poste (celle sur laquelle
 * un téléphone du même réseau local peut joindre ce serveur), ou `null` si
 * aucune interface réseau active n'en expose une (ex: poste hors réseau).
 */
export function getLocalIPv4(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addresses = interfaces[name];
    if (!addresses) continue;
    for (const addr of addresses) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return null;
}

/** Port du serveur Next.js, lu depuis `process.env.PORT` (défaut 3000). */
export function getSyncPort(): number {
  const raw = process.env.PORT;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}
