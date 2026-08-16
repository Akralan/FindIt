/**
 * Accès bas niveau au fichier data/db.json. Stockage JSON simple, sans
 * dépendance externe ni verrou — usage mono-utilisateur. Ces helpers sont
 * internes au module `src/lib/db/` : seuls `documents.ts` et `events.ts`
 * doivent les importer.
 */

import { promises as fs } from "fs";
import path from "path";
import type { DocumentRecord, DocumentEvent } from "@/lib/types";
import { resolveDataDir } from "@/lib/storage/files";

export interface DbShape {
  documents: DocumentRecord[];
  events: DocumentEvent[];
}

function dbFilePath(): string {
  return path.join(resolveDataDir(), "db.json");
}

function emptyDb(): DbShape {
  return { documents: [], events: [] };
}

/**
 * Lit data/db.json. Si le fichier est absent, le crée avec une structure
 * vide (et crée DATA_DIR au passage) puis la retourne.
 */
export async function readDb(): Promise<DbShape> {
  const filePath = dbFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    return {
      documents: parsed.documents ?? [],
      events: parsed.events ?? [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      const db = emptyDb();
      await writeDb(db);
      return db;
    }
    throw err;
  }
}

/** Écrit `db` dans data/db.json, en créant le dossier parent si absent. */
export async function writeDb(db: DbShape): Promise<void> {
  const filePath = dbFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(db, null, 2), "utf-8");
}
