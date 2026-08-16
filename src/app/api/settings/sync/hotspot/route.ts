import { NextResponse } from "next/server";

import {
  getHotspotIPv4,
  getHotspotStatus,
  startHotspotElevated,
  stopHotspotElevated,
} from "@/lib/sync/hotspot";
import { getSyncToken } from "@/lib/sync/token";
import { buildPairingInfo } from "@/lib/sync/pairing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * Après `startHotspotElevated()`, l'interface réseau virtuelle du point
 * d'accès met parfois un instant à apparaître côté Windows. On patiente
 * un peu avant de construire le QR plutôt que de renvoyer tout de suite un
 * `host: null` qui obligerait l'utilisateur à recharger la page.
 */
async function waitForHotspotIPv4(): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (getHotspotIPv4()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * GET /api/settings/sync/hotspot
 * Statut actuel du point d'accès mobile (lecture seule, pas d'élévation).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const status = await getHotspotStatus();
    return NextResponse.json({ ...status, platform: process.platform });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

interface HotspotActionBody {
  action?: unknown;
}

/**
 * POST /api/settings/sync/hotspot
 * Body `{ action: "start" | "stop" }`. Démarre/arrête le point d'accès
 * mobile via une invite d'élévation Windows (UAC) — voir
 * `src/lib/sync/hotspot.ts` et SYNC_CONTRACTS.md §1bis. En cas de démarrage
 * réussi, retourne `{ ok: true, pairingInfo }` avec le QR complet (payload
 * incluant le champ `hotspot`) prêt à afficher côté Réglages.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: HotspotActionBody;
  try {
    body = (await request.json()) as HotspotActionBody;
  } catch {
    return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }

  const { action } = body;
  if (action !== "start" && action !== "stop") {
    return NextResponse.json(
      { error: 'Action invalide : "start" ou "stop" attendu.' },
      { status: 400 }
    );
  }

  if (action === "stop") {
    try {
      await stopHotspotElevated();
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
  }

  // action === "start"
  if (process.platform !== "win32") {
    return NextResponse.json(
      { error: "Cette action n'est disponible que sur Windows." },
      { status: 400 }
    );
  }

  try {
    const credentials = await startHotspotElevated();
    await waitForHotspotIPv4();
    const token = await getSyncToken();
    const pairingInfo = await buildPairingInfo(token, credentials);
    return NextResponse.json({ ok: true, pairingInfo });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
