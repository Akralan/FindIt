import { NextResponse } from "next/server";

import { searchDocuments } from "@/lib/search/semantic";

export const runtime = "nodejs";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * GET /api/search?q=...
 */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") ?? "").trim();

    if (query.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchDocuments(query);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
