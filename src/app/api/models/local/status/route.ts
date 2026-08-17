import { NextResponse } from "next/server";
import { getLocalModelStatus } from "@/lib/models/manager";

export const runtime = "nodejs";

/**
 * GET /api/models/local/status
 * Pollé par la page Réglages pendant le téléchargement du modèle local.
 */
export async function GET(): Promise<NextResponse> {
  const status = await getLocalModelStatus();
  return NextResponse.json({ status });
}
