import { NextResponse } from "next/server";

import type { DocumentStatus } from "@/lib/types";
import { listDocuments } from "@/lib/db/documents";

export const runtime = "nodejs";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

function isDocumentStatus(value: string): value is DocumentStatus {
  return value === "pending_review" || value === "confirmed";
}

/**
 * GET /api/documents?category=&status=
 */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") ?? undefined;
    const statusParam = searchParams.get("status") ?? undefined;

    if (statusParam !== undefined && !isDocumentStatus(statusParam)) {
      return NextResponse.json(
        { error: "Paramètre \"status\" invalide : valeurs acceptées \"pending_review\" ou \"confirmed\"." },
        { status: 400 }
      );
    }

    const documents = await listDocuments(category ? { category } : undefined);
    const filtered = statusParam ? documents.filter((doc) => doc.status === statusParam) : documents;

    return NextResponse.json({ documents: filtered });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
