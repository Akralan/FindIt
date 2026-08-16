/**
 * Construction des informations de pairing affichées dans la section
 * Synchro des Réglages (QR code + IP/port/jeton en clair, utile en secours
 * si le scan échoue). Consommé uniquement par les routes internes
 * `src/app/api/settings/sync/*` — le mobile ne connaît que le JSON encodé
 * dans le QR, pas cette route.
 */

import QRCode from "qrcode";
import { getLocalIPv4, getSyncPort } from "./network";
import { getHotspotIPv4, type HotspotCredentials } from "./hotspot";

export interface SyncPairingInfo {
  host: string | null;
  port: number;
  token: string;
  /** Data URL PNG du QR code, ou `null` si aucune IP locale n'a été détectée. */
  qrDataUrl: string | null;
  /**
   * Présent uniquement en mode hotspot (voir SYNC_CONTRACTS.md §1bis) :
   * identifiants du point d'accès mobile encodés dans le QR, pour que le
   * mobile propose de rejoindre ce réseau avant d'enregistrer le pairing.
   */
  hotspot?: HotspotCredentials | null;
}

/**
 * Construit les informations de pairing à afficher pour `token`.
 *
 * Sans argument `hotspot` (mode normal, comportement historique) : `host`
 * est l'IP locale du PC sur son interface réseau habituelle, et le payload
 * du QR ne contient pas de champ `hotspot`.
 *
 * Avec `hotspot` (mode point d'accès mobile) : `host` devient l'IP du PC sur
 * l'interface créée par le point d'accès (`192.168.137.x`), et le payload du
 * QR inclut `{ hotspot: { ssid, password } }` — voir SYNC_CONTRACTS.md
 * §1bis pour le format exact et pourquoi ce mode existe.
 */
export async function buildPairingInfo(
  token: string,
  hotspot?: HotspotCredentials
): Promise<SyncPairingInfo> {
  const port = getSyncPort();

  if (hotspot) {
    const host = getHotspotIPv4();
    if (!host) {
      return { host: null, port, token, qrDataUrl: null, hotspot };
    }
    const payload = JSON.stringify({ host, port, token, hotspot });
    const qrDataUrl = await QRCode.toDataURL(payload);
    return { host, port, token, qrDataUrl, hotspot };
  }

  const host = getLocalIPv4();
  if (!host) {
    return { host: null, port, token, qrDataUrl: null };
  }

  const payload = JSON.stringify({ host, port, token });
  const qrDataUrl = await QRCode.toDataURL(payload);
  return { host, port, token, qrDataUrl };
}
