/**
 * Construction des informations de pairing affichées dans la section
 * Synchro des Réglages (QR code + IP/port/jeton en clair, utile en secours
 * si le scan échoue). Consommé uniquement par les routes internes
 * `src/app/api/settings/sync/*` — le mobile ne connaît que le JSON encodé
 * dans le QR, pas cette route.
 */

import QRCode from "qrcode";
import { getLocalIPv4, getSyncPort } from "./network";

export interface SyncPairingInfo {
  host: string | null;
  port: number;
  token: string;
  /** Data URL PNG du QR code, ou `null` si aucune IP locale n'a été détectée. */
  qrDataUrl: string | null;
}

/** Construit les informations de pairing à afficher pour `token`. */
export async function buildPairingInfo(token: string): Promise<SyncPairingInfo> {
  const host = getLocalIPv4();
  const port = getSyncPort();

  if (!host) {
    return { host: null, port, token, qrDataUrl: null };
  }

  const payload = JSON.stringify({ host, port, token });
  const qrDataUrl = await QRCode.toDataURL(payload);
  return { host, port, token, qrDataUrl };
}
