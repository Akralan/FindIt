import { NextResponse } from "next/server";

import type { ProviderConfig, ProviderId } from "@/lib/types";
import { getPublicConfig, updateConfig } from "@/lib/config";

export const runtime = "nodejs";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

function isProviderId(value: unknown): value is ProviderId {
  return value === "openai" || value === "mock";
}

function isValidConfigPatch(body: unknown): body is Partial<ProviderConfig> {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (b.provider !== undefined && !isProviderId(b.provider)) return false;
  if (b.openaiApiKey !== undefined && typeof b.openaiApiKey !== "string") return false;
  if (b.openaiModel !== undefined && typeof b.openaiModel !== "string") return false;
  if (b.openaiEmbeddingModel !== undefined && typeof b.openaiEmbeddingModel !== "string") return false;
  return true;
}

/**
 * GET /api/settings
 */
export async function GET(): Promise<NextResponse> {
  try {
    const config = await getPublicConfig();
    return NextResponse.json({ config });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

/**
 * POST /api/settings
 * body: Partial<ProviderConfig>
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
    }

    if (!isValidConfigPatch(rawBody)) {
      return NextResponse.json(
        {
          error:
            "Corps de requête invalide : champs acceptés \"provider\", \"openaiApiKey\", \"openaiModel\", \"openaiEmbeddingModel\".",
        },
        { status: 400 }
      );
    }

    await updateConfig(rawBody);
    const config = await getPublicConfig();

    return NextResponse.json({ config });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
