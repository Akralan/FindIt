import { NextResponse } from "next/server";

import { regenerateSyncToken } from "@/lib/sync/token";
import { buildPairingInfo } from "@/lib/sync/pairing";

export const runtime = "nodejs";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * POST /api/settings/sync/regenerate
 * Route interne à la page Réglages. Génère un nouveau jeton de synchro,
 * invalidant l'ancien — tout appareil déjà pairé devra re-scanner le QR.
 * Retourne les nouvelles informations de pairing.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const token = await regenerateSyncToken();
    const info = await buildPairingInfo(token);
    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
