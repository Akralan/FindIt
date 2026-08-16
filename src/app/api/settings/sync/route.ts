import { NextResponse } from "next/server";

import { getSyncToken } from "@/lib/sync/token";
import { buildPairingInfo } from "@/lib/sync/pairing";

export const runtime = "nodejs";
// Dépend de l'état réseau au moment de l'appel et peut générer/persister le
// jeton en effet de bord au premier appel : ne doit jamais être évalué (et
// mis en cache) au moment du build.
export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * GET /api/settings/sync
 * Route interne à la page Réglages (pas dans SYNC_CONTRACTS.md : le mobile
 * ne connaît que le JSON encodé dans le QR, pas cette route). Retourne les
 * informations de pairing (IP locale, port, jeton, QR en data URL),
 * générant le jeton s'il n'existe pas encore.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const token = await getSyncToken();
    const info = await buildPairingInfo(token);
    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
