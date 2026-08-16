/**
 * Persistance du pairing (host/port/token) via `expo-secure-store`
 * (Keystore Android / Keychain iOS). Le token n'est jamais loggé — voir
 * `parsePairingPayload` (src/utils/qrPayload.ts) qui ne journalise pas non
 * plus le contenu scanné.
 */

import * as SecureStore from "expo-secure-store";

import type { PairingInfo } from "@/types/document";

const KEY_HOST = "findit_pairing_host";
const KEY_PORT = "findit_pairing_port";
const KEY_TOKEN = "findit_pairing_token";

export async function savePairing(pairing: PairingInfo): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_HOST, pairing.host),
    SecureStore.setItemAsync(KEY_PORT, String(pairing.port)),
    SecureStore.setItemAsync(KEY_TOKEN, pairing.token),
  ]);
}

export async function loadPairing(): Promise<PairingInfo | null> {
  const [host, port, token] = await Promise.all([
    SecureStore.getItemAsync(KEY_HOST),
    SecureStore.getItemAsync(KEY_PORT),
    SecureStore.getItemAsync(KEY_TOKEN),
  ]);

  if (!host || !port || !token) {
    return null;
  }

  const parsedPort = Number.parseInt(port, 10);
  if (!Number.isFinite(parsedPort)) {
    return null;
  }

  return { host, port: parsedPort, token };
}

export async function clearPairing(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_HOST),
    SecureStore.deleteItemAsync(KEY_PORT),
    SecureStore.deleteItemAsync(KEY_TOKEN),
  ]);
}
