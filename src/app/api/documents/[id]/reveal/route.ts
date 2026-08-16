import { execFile } from "child_process";
import { NextResponse } from "next/server";

import { getDocument } from "@/lib/db/documents";
import { getAbsolutePath } from "@/lib/storage/files";

export const runtime = "nodejs";

interface RouteContext {
  params: { id: string };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur inattendue est survenue.";
}

/**
 * Ouvre le gestionnaire de fichiers du système avec le fichier sélectionné.
 * N'a de sens que pour une installation auto-hébergée mono-utilisateur : le
 * serveur et le navigateur tournent sur la même machine.
 */
function revealInFileManager(absPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;

    if (platform === "win32") {
      // /select, doit être un seul argument, sans espace après la virgule.
      execFile("explorer.exe", [`/select,${absPath}`], (err) => {
        // explorer.exe renvoie souvent un code de sortie non nul même en cas
        // de succès : on ne considère en échec que les erreurs de spawn
        // (ex: binaire introuvable), pas le code de sortie du process.
        if (err && (err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(new Error("explorer.exe introuvable."));
          return;
        }
        resolve();
      });
      return;
    }

    if (platform === "darwin") {
      execFile("open", ["-R", absPath], (err) => {
        if (err) reject(err);
        else resolve();
      });
      return;
    }

    reject(
      new Error(
        "Ouverture automatique du gestionnaire de fichiers non supportée sur ce système. Chemin à ouvrir manuellement : " +
          absPath
      )
    );
  });
}

/**
 * POST /api/documents/:id/reveal
 * Ouvre l'Explorateur (ou équivalent) avec le fichier du document
 * sélectionné. Réservé à un usage local : le serveur doit tourner sur la
 * machine de l'utilisateur.
 */
export async function POST(_req: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const document = await getDocument(params.id);
    if (!document) {
      return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    }

    const absPath = getAbsolutePath(document.filePath);
    await revealInFileManager(absPath);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
