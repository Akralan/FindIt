import { NextResponse } from "next/server";

import { listCategories } from "@/lib/db/documents";

export const runtime = "nodejs";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * GET /api/documents/categories
 */
export async function GET(): Promise<NextResponse> {
  try {
    const categories = await listCategories();
    return NextResponse.json({ categories });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
