import type { PairingInfo } from "@/types/document";

/**
 * Libellé honnête de l'appareil pairé : l'hôte réel du pairing (IP du PC sur
 * le réseau local), jamais un nom d'appareil inventé — voir consigne de
 * cadrage (le mockup source montrait "MacBook de Camille" à titre d'exemple).
 */
export function deviceLabel(pairing: PairingInfo | null): string {
  return pairing ? pairing.host : "Non connecté";
}
