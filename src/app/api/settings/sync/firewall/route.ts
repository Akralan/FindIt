import { NextResponse } from "next/server";

import { firewallRuleExists, requestFirewallRuleElevated } from "@/lib/sync/firewall";
import { getSyncPort } from "@/lib/sync/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * GET /api/settings/sync/firewall
 * Indique si la règle de pare-feu FindIt existe déjà (lecture seule, pas
 * de droits admin requis).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const exists = await firewallRuleExists();
    return NextResponse.json({ exists, platform: process.platform });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

/**
 * POST /api/settings/sync/firewall
 * Déclenche le popup d'élévation Windows (UAC) pour ouvrir le port de
 * synchro dans le pare-feu, sur tous les profils réseau (Domain/Private/
 * Public — voir SYNC_CONTRACTS.md §1bis pour la justification). Voir
 * src/lib/sync/firewall.ts pour le détail du mécanisme et pourquoi c'est
 * fait ainsi (jamais de modification silencieuse du pare-feu).
 */
export async function POST(): Promise<NextResponse> {
  if (process.platform !== "win32") {
    return NextResponse.json(
      { error: "Cette action n'est disponible que sur Windows." },
      { status: 400 }
    );
  }

  try {
    const port = getSyncPort();
    await requestFirewallRuleElevated(port);
    const exists = await firewallRuleExists();

    if (!exists) {
      return NextResponse.json(
        {
          error:
            "La règle n'a pas été créée — vous avez peut-être refusé l'invite Windows, ou une erreur est survenue.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, port });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
