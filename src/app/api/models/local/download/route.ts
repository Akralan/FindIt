import { NextResponse } from "next/server";
import { startLocalModelDownload } from "@/lib/models/manager";

export const runtime = "nodejs";

/**
 * POST /api/models/local/download
 * Déclenche le téléchargement du modèle local — idempotent : si déjà en
 * cours ou déjà prêt, renvoie juste le statut courant sans relancer quoi
 * que ce soit.
 */
export async function POST(): Promise<NextResponse> {
  const status = await startLocalModelDownload();
  return NextResponse.json({ status });
}
